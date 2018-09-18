const sql = require('mssql');
let Observable = require('rxjs/Observable').Observable;
let prettyjson = require('prettyjson');
require('rxjs/add/operator/map');
require('rxjs/add/observable/fromPromise');

class DbService {

  constructor() {
    this.instanceRequest = null;
    this.dbUrl = `mssql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/SQLEXPRESS/${process.env.DB_NAME}`;
    //console.log(this.dbUrl);
  }

  init() {
    return Observable.fromPromise(
      sql.connect(this.dbUrl)
      .then(pool => pool.request())
      .catch(err => console.error(err))
    ).map(request => {
      this.instanceRequest = request;
      return request;
    });

    sql.on('error', err => console.log(err.red));
  }

  query(queryString) {
    console.log(queryString.cyan);

    return Observable.fromPromise(
      this.instanceRequest.query(queryString)
      .then(({ recordsets }) => {
        console.log(prettyjson.render(recordsets))
        return recordsets;
      })
      .catch(err => {
        console.log(err);
        return err;
      })
    ).map(recordsets => recordsets);
  }

  execute(procName, input, output) {
    console.log(procName.cyan);
    input && console.log(prettyjson.render(input));
    output && console.log(prettyjson.render(output));

    this.instanceRequest.parameters = {};

    for (let i in input) {
      this.instanceRequest.input(`${i}`, input[i]);
    }

    if (output) {
      for (let o in output) {
        this.instanceRequest.output(`${o}`, input[o]);
      }
    }

    return Observable.fromPromise(
      this.instanceRequest.execute(procName)
      .then((response) => response)
      .catch(err => console.log(err))
    )
  }
}

module.exports = DbService;