// Update with your config settings.

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
module.exports = {

    client: 'mysql2',
    connection: {
        host: '127.0.0.1',
        database: 'volcanoes',
        port: 3306,
        user: 'root',
        password: 'password'
    }

};
