module.exports = {
  development: {
    url: process.env.DB_CONNECTION_STRING,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  production: {
    url: process.env.DB_CONNECTION_STRING,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  }
};