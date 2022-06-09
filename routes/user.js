const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

var router = express.Router();


/* GET users listing. */
router.get('/', function (req, res, next) {
    res.send('respond with a resource');
}, );

/* POST register a new user */
router.post('/register', (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    if (!email || !password) {
        res.status(400).json({ error: true, message: 'Request body incomplete, both email and password are required' });
        return;
    }

    const queryUsers = req.db.from('users').select('*').where('email', '=', email);
    queryUsers.then((users) => {
        if (users.length > 0) {
            res.status(409).json({ error: true, message: 'User already exists' });
            return;
        }

        const saltRounds = 10;
        const hash = bcrypt.hashSync(password, saltRounds);
        res.status(201).json({ message: "User Created" });
        return req.db.from('users').insert({ email, hash })
    });

});

/* POST Login with existing user */
router.post('/login', (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    if (!email || !password) {
        res.status(400).json({ error: true, message: 'Request body incomplete, both email and password are required' });
        return;
    }

    const queryUsers = req.db.from('users').select('*').where('email', '=', email);
    queryUsers.then((users) => {
        if (users.length == 0) {
            res.status(401).json({ error: true, message: 'Incorrect email or password' });
            return;
        }

        const user = users[0];

        bcrypt.compare(password, user.hash).then((same) => {
            if (!same) {
                res.status(401).json({ error: true, message: 'Incorrect email or password' });
                return;
            }
            const secretKey = process.env.SECRET_KEY;
            const expiresIn = 24 * 60 * 60;
            const exp = Date.now() + expiresIn * 1000
            const token = jwt.sign({ email, exp }, secretKey);
            res.status(200).json({ token: token, token_type: 'Bearer', expires_in: expiresIn });

        });
    });
});

/* GET request for user profile */
router.get('/:email/profile', (req, res) => {
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
            if (decoded.email == req.params.email) {
                authorized = true;
            }
        } catch (e) {
            res.status(401).json({ error: true, message: 'Invalid JWT token' });
            return;
        }
    }

    const userQuery = req.db.from('users').where('email', '=', req.params.email).select('email', 'firstName', 'lastName');
    if (authorized) {
        userQuery.select('address', 'dob');
    }

    userQuery.then((user) => {
        if (user.length == 0) {
            res.status(404).json({ error: true, message: 'User not found' });
            return;
        }
        res.status(200).send(user[0]);
        return;
    })
});



/* Authorization middleware for PUT request */
const authorize = (req, res, next) => {

    const authorization = req.headers.authorization;
    if (!authorization) {
        res.status(401).json({ error: true, message: 'Authorization header ("Bearer token") not found' });
        return;
    }

    let token = null;

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
        res.locals.decoded = decoded;
        next();
    } catch (e) {
        res.status(401).json({ error: true, message: 'Invalid JWT token' });
        return;
    }
}

router.put('/:email/profile', authorize, (req, res) => {

    const decoded = res.locals.decoded;
    const email = req.params.email;
    const firstName = req.body.firstName;
    const lastName = req.body.lastName;
    const dob = req.body.dob;
    const address = req.body.address;

    if (decoded.email !== email) {
        res.status(403).json({ error: true, message: 'Forbidden' });
        return;
    }

    if (!firstName || !lastName || !dob || !address) {
        res.status(400).json({
            error: true, message: 'Request body incomplete: firstName, lastName, dob and address are required.'
        });
        return;
    }

    if (typeof (firstName) != 'string' || typeof (lastName) != 'string' || typeof (address) != 'string') {
        res.status(400).json({
            error: true, message: 'Request body invalid: firstName, lastName and address must be strings only.'
        });
        return;
    }

    const y = dob.split('-')[0];
    const m = dob.split('-')[1];
    const d = dob.split('-')[2];

    /* Valid format check */
    const dateFormat = /^\d{4}\-\d{2}\-\d{2}$/;
    if (!dateFormat.test(dob)) {
        res.status(400).json({ error: true, message: 'Invalid input: dob must be a real date in format YYYY-MM-DD.' });
        return;
    }

    /* Out of bounds check */
    var tempDate = new Date(dob);
    if (isNaN(tempDate.getTime())) {
        res.status(400).json({ error: true, message: 'Invalid input: dob must be a real date in format YYYY-MM-DD.' });
        return;
    }

    /* Rollover check */
    console.log(m, d);
    if ((m == 4 || m == 6 || m == 9 || m == 11) && d > 30) {
        res.status(400).json({ error: true, message: 'Invalid input: dob must be a real date in format YYYY-MM-DD.' });
        return;
    }

    /* Leapyear check */
    if (m == 2) {
        if (((y % 4 == 0) && (y % 100 != 0)) || (y % 400 == 0)) {
            if (d > 29) {
                res.status(400).json({ error: true, message: 'Invalid input: dob must be a real date in format YYYY-MM-DD.' });
                return;
            }
        } else {
            if (d > 28) {
                res.status(400).json({ error: true, message: 'Invalid input: dob must be a real date in format YYYY-MM-DD.' });
                return;
            }
        }
    }

    /* Future check */
    if (tempDate - Date.now() > 0) {
        res.status(400).json({
            error: true, message: 'Invalid input: dob must be a date in the past.'
        });
        return;
    }

    req.db.select('*').from('users').where('email', '=', email).update({
        email: email,
        firstName: firstName,
        lastName: lastName,
        address: address,
        dob: dob
    })
        .then(() => {
            res.status(200).json({
                email: email,
                firstName: firstName,
                lastName: lastName,
                dob: dob,
                address: address
            });
        });
});

module.exports = router;
