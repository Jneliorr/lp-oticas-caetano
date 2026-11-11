"use strict";

const path = require("node:path");
const express = require("express");

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.disable("x-powered-by");
app.use(express.static(path.join(__dirname, "dist")));

app.listen(port, "0.0.0.0");
