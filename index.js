let express = require("express");
let app = express();
require("colors");
require("dotenv").config();
var bodyParser = require("body-parser");
var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");

let DbService = require("./services/db.service");

let Observable = require("rxjs/Observable").Observable;
require("rxjs/add/operator/map");
require("rxjs/add/observable/fromPromise");

let dbService = new DbService();

const PORT = process.env.PORT || 8889;

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,HEAD,OPTIONS,POST,PUT,DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers, Authorization"
  );
  next();
});

function authorization(req) {
  if (req.headers && req.headers.authorization) {
    var authorization = req.headers.authorization.split(" ")[1];
    var decoded = jwt.verify(authorization, "secret");
    var userId = decoded.id;
    return userId;
  } else {
    return null;
  }
}

const auth = (req, res, next) => {
  const userId = authorization(req);
  if (userId !== null) {
    req.userId = userId;
    next();
  } else {
    res
      .status(400)
      .json({ message: "Invalid auth token provided." })
      .end();
  }
};

app.get("/api/verify-token", (req, res) => {
  const userId = authorization(req);
  let inputParams = {
    p: userId
  };
  if (!userId) res.send({});
  dbService.execute("selectUsers", inputParams).subscribe(q => {
    if (q && q.recordsets && q.recordsets[0] && q.recordsets[0][0]) {
      res.send({ user: q.recordsets[0][0] });
    } else {
      res.send({});
    }
  });
});

app.post("/api/posts", auth, (req, res) => {
  let userId = req.userId;

  if (!userId) {
    res.send({ status: null });
  } else {
    let { title, content } = req.body;

    let inputParams = {
      pTitle: title,
      pContent: content,
      pUserId: userId
    };

    let outputParams = {
      status: null
    };

    dbService
      .execute("createPost", inputParams, outputParams)
      .subscribe(query => {
        if (Number(query.output.status) === 1) {
          dbService
            .query(`select top 1 * from POSTS order by id desc`)
            .subscribe(query => {
              res.send({ post: query[0][0] });
            });
        } else {
          res.send(query);
        }
      });
  }
});

app.put("/api/posts", (req, res) => {
  let userId = authorization(req);

  if (!userId) {
    res.send({ status: null });
  } else {
    let { title, content, id } = req.body;

    dbService
      .query(
        `Update POSTS SET title = '${title}', content = '${content}', created_at = GETDATE() where userId = '${userId}' and Id = '${id}'`
      )
      .subscribe(query => {
        res.send({ status: 1 });
      });
  }
});

app.get("/api/getallusers", (req, res) => {
  dbService.query(`Select login from Users`).subscribe(query => {
    res.send({ users: query });
  });
});
app.get("/api/posts", (req, res) => {
  let { userId } = req.query;
  dbService
    .query(
      `Select id, title, content, created_at from POSTS where userId = '${userId}'`
    )
    .subscribe(query => {
      res.send(query);
    });
});
app.get("/api/getallposts", (req, res) => {
  dbService.query(`select * from postParams()`).subscribe(query => {
    res.send({ posts: query });
  });
});

app.delete("/api/posts", (req, res) => {
  let userId = authorization(req);

  let { postId } = req.query;
  if (!userId) {
    res.send({ status: null });
  } else {
    dbService
      .query(
        `Delete from POSTS where Id = '${postId}' and userId = '${userId}'`
      )
      .subscribe(query => {
        res.send({ status: 1 });
      });
  }
});

app.get("/api/users", (req, res) => {
  dbService.query(`SELECT * FROM UsersParams()`).subscribe(query => {
    res.send(query);
  });
});

app.get("/api/search-users", (req, res) => {
  let { fullMatch, login } = req.query;

  if (fullMatch === "true") {
    dbService
      .query(`SELECT * FROM findFullMatchUser('${login}')`)
      .subscribe(query => {
        res.send(query);
      });
  } else {
    let inputParams = {
      pLogin: login
    };

    dbService.execute("getAllMatchingUser", inputParams).subscribe(query => {
      res.send(query.recordsets);
    });
  }
});

app.post("/api/users", (req, res) => {
  let { login, password } = req.body;

  let inputParams = {
    pLogin: login,
    pPassword: password
  };

  let outputParams = {
    status: null
  };

  dbService
    .execute("createUser", inputParams, outputParams)
    .subscribe(query => {
      if (Number(query.output.status) === 1) {
        dbService
          .query(`SELECT * FROM findFullMatchUser('${login}')`)
          .subscribe(q => {
            const user = q[0][0];
            var token = jwt.sign({ id: user.id, login: user.login }, "secret", {
              expiresIn: 86400 // expires in 24 hours
            });
            res.send({ output: { status: 1 }, user: { ...user, token } });
          });
      } else {
        res.send(query);
      }
    });
});

app.post("/api/authenticate", (req, res) => {
  let { login, password } = req.body;
  let inputParams = {
    pLogin: login,
    pPassword: password
  };

  dbService.execute("loginUser", inputParams).subscribe(query => {
    let userId = query && query.returnValue;
    if (!userId) {
      res.send({ currentUser: null });
    } else {
      dbService
        .query(`SELECT id, login FROM USERS where Id = '${userId}'`)
        .subscribe(query => {
          let user = query && query[0] && query[0][0];

          if (!user) {
            res.send({ currentUser: null });
          }

          var token = jwt.sign({ id: user.id, login: user.login }, "secret", {
            expiresIn: 86400 // expires in 24 hours
          });

          res.send({
            currentUser: { login: user.login, id: user.id, token: token }
          });
        });
    }
  });
});

app.listen(PORT, () => {
  dbService.init().subscribe(() => {
    console.log("successful connecting to database...".magenta);
  });
});
