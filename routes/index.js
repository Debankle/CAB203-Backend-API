const express = require('express');
const jwt = require('jsonwebtoken');
const swaggerUI = require('swagger-ui-express');
const swaggerDocs = require('../docs/swagger.json');
require('dotenv').config();

var router = express.Router();

router.use(swaggerUI.serve);

router.get('/', swaggerUI.setup(swaggerDocs));

/* GET Countries Endpoint */
router.get('/countries', (req, res) => {

    const countryQuery = req.db.from('data').select(req.db.raw('distinct country'));
    countryQuery.then((countries) => {
        let countryArr = new Array();
        for (var i = 0; i < countries.length; i++) {
            countryArr.push(countries[i].country);
        }
        res.status(200).send(countryArr.sort());
    })
        .catch((err) => {
            res.status(500).json({ "error": true, "message": err });
            return;
        });
});

/* GET Volcanoes in a specific country and population radius */
router.get('/volcanoes', (req, res) => {

    if (Object.entries(req.query).length === 0) {
        res.status(400).json({ error: true, message: 'Invalid query parameters. Only country and populatedWithin are permitted.' });
        return;
    }

    for (key in req.query) {
        if (key != 'country' && key != 'populatedWithin') {
            res.status(400).json({ error: true, message: 'Invalid query parameters. Only country and populatedWithin are permitted.' });
            return;
        }
    }

    let filter = {};

    if (req.query.county === null) {
        res.status(400).json({ error: true, message: 'Country is a required query parameter.' });
        return;
    } else {
        filter.country = req.query.country;
    }

    const volcanoQuery = req.db.from('data').select('id', 'name', 'country', 'region', 'subregion').where(filter);

    if (req.query.populatedWithin != null) {

        switch (req.query.populatedWithin) {
            case '5km': volcanoQuery.andWhere('population_5km', '>', '0');
                break;
            case '10km': volcanoQuery.andWhere('population_10km', '>', '0');
                break;
            case '30km': volcanoQuery.andWhere('population_30km', '>', '0');
                break;
            case '100km': volcanoQuery.andWhere('population_100km', '>', '0');
                break;
            default: res.status(400).json({ error: true, message: 'Invalid value for populatedWithin. Only: 5km,10km,30km,100km are permitted.' });
                return;
        }
    }

    volcanoQuery.then((volcanoes) => {
        res.status(200).send(volcanoes);
    })
        .catch((err) => {
            res.status(500).json({ error: true, message: err });
        });

});

/* GET individual volcano */
router.get('/volcano/:id', (req, res) => {

    const authorization = req.headers.authorization;
    let authorized = false;
    let token = null;
    let decoded = null;

    if (authorization) {
        if (authorization && authorization.split(' ').length == 2) {
            token = authorization.split(' ')[1];
        } else {
            res.status(401).json({ error: true, message: 'Authorization header is malformed' });
            return;
        }

        try {
            decoded = jwt.verify(token, process.env.SECRET_KEY);
            if (decoded.exp < Date.now()) {
                res.status(401).json({ error: true, message: 'JWT token has expired' });
                return;
            }
            authorized = true;
        } catch (e) {
            res.status(401).json({ error: true, message: 'Invalid JWT token' });
            return;
        }
    }

    const volcanoQuery = req.db.from('data').select('id', 'name', 'country', 'region', 'subregion', 'last_eruption', 'summit', 'elevation', 'latitude', 'longitude').where('id', '=', req.params.id);
    if (authorized) {
        volcanoQuery.select('population_5km', 'population_10km', 'population_30km', 'population_100km');
    }

    volcanoQuery.then((volcano) => {
        if (volcano.length == 1) {
            res.status(200).send(volcano[0]);
        } else {
            res.status(404).json({ error: true, message: `Volcano with id ${req.params.id} not found` });
        }
    }).catch((err) => {
        res.status(500).send(err);
    })

});

router.get('/me', (req, res) => {
    res.status(200).json({
        "name": "Oliver Pinel",
        "student_number": "n11028891"
    });
});

module.exports = router;
