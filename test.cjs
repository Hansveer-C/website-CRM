"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/better-sqlite3/lib/util.js
var require_util = __commonJS({
  "node_modules/better-sqlite3/lib/util.js"(exports2) {
    "use strict";
    exports2.getBooleanOption = (options, key) => {
      let value = false;
      if (key in options && typeof (value = options[key]) !== "boolean") {
        throw new TypeError(`Expected the "${key}" option to be a boolean`);
      }
      return value;
    };
    exports2.cppdb = /* @__PURE__ */ Symbol();
    exports2.inspect = /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom");
  }
});

// node_modules/better-sqlite3/lib/sqlite-error.js
var require_sqlite_error = __commonJS({
  "node_modules/better-sqlite3/lib/sqlite-error.js"(exports2, module2) {
    "use strict";
    var descriptor = { value: "SqliteError", writable: true, enumerable: false, configurable: true };
    function SqliteError(message, code) {
      if (new.target !== SqliteError) {
        return new SqliteError(message, code);
      }
      if (typeof code !== "string") {
        throw new TypeError("Expected second argument to be a string");
      }
      Error.call(this, message);
      descriptor.value = "" + message;
      Object.defineProperty(this, "message", descriptor);
      Error.captureStackTrace(this, SqliteError);
      this.code = code;
    }
    Object.setPrototypeOf(SqliteError, Error);
    Object.setPrototypeOf(SqliteError.prototype, Error.prototype);
    Object.defineProperty(SqliteError.prototype, "name", descriptor);
    module2.exports = SqliteError;
  }
});

// node_modules/file-uri-to-path/index.js
var require_file_uri_to_path = __commonJS({
  "node_modules/file-uri-to-path/index.js"(exports2, module2) {
    var sep = require("path").sep || "/";
    module2.exports = fileUriToPath;
    function fileUriToPath(uri) {
      if ("string" != typeof uri || uri.length <= 7 || "file://" != uri.substring(0, 7)) {
        throw new TypeError("must pass in a file:// URI to convert to a file path");
      }
      var rest = decodeURI(uri.substring(7));
      var firstSlash = rest.indexOf("/");
      var host = rest.substring(0, firstSlash);
      var path = rest.substring(firstSlash + 1);
      if ("localhost" == host) host = "";
      if (host) {
        host = sep + sep + host;
      }
      path = path.replace(/^(.+)\|/, "$1:");
      if (sep == "\\") {
        path = path.replace(/\//g, "\\");
      }
      if (/^.+\:/.test(path)) {
      } else {
        path = sep + path;
      }
      return host + path;
    }
  }
});

// node_modules/bindings/bindings.js
var require_bindings = __commonJS({
  "node_modules/bindings/bindings.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var fileURLToPath = require_file_uri_to_path();
    var join = path.join;
    var dirname = path.dirname;
    var exists = fs.accessSync && function(path2) {
      try {
        fs.accessSync(path2);
      } catch (e) {
        return false;
      }
      return true;
    } || fs.existsSync || path.existsSync;
    var defaults = {
      arrow: process.env.NODE_BINDINGS_ARROW || " \u2192 ",
      compiled: process.env.NODE_BINDINGS_COMPILED_DIR || "compiled",
      platform: process.platform,
      arch: process.arch,
      nodePreGyp: "node-v" + process.versions.modules + "-" + process.platform + "-" + process.arch,
      version: process.versions.node,
      bindings: "bindings.node",
      try: [
        // node-gyp's linked version in the "build" dir
        ["module_root", "build", "bindings"],
        // node-waf and gyp_addon (a.k.a node-gyp)
        ["module_root", "build", "Debug", "bindings"],
        ["module_root", "build", "Release", "bindings"],
        // Debug files, for development (legacy behavior, remove for node v0.9)
        ["module_root", "out", "Debug", "bindings"],
        ["module_root", "Debug", "bindings"],
        // Release files, but manually compiled (legacy behavior, remove for node v0.9)
        ["module_root", "out", "Release", "bindings"],
        ["module_root", "Release", "bindings"],
        // Legacy from node-waf, node <= 0.4.x
        ["module_root", "build", "default", "bindings"],
        // Production "Release" buildtype binary (meh...)
        ["module_root", "compiled", "version", "platform", "arch", "bindings"],
        // node-qbs builds
        ["module_root", "addon-build", "release", "install-root", "bindings"],
        ["module_root", "addon-build", "debug", "install-root", "bindings"],
        ["module_root", "addon-build", "default", "install-root", "bindings"],
        // node-pre-gyp path ./lib/binding/{node_abi}-{platform}-{arch}
        ["module_root", "lib", "binding", "nodePreGyp", "bindings"]
      ]
    };
    function bindings(opts) {
      if (typeof opts == "string") {
        opts = { bindings: opts };
      } else if (!opts) {
        opts = {};
      }
      Object.keys(defaults).map(function(i2) {
        if (!(i2 in opts)) opts[i2] = defaults[i2];
      });
      if (!opts.module_root) {
        opts.module_root = exports2.getRoot(exports2.getFileName());
      }
      if (path.extname(opts.bindings) != ".node") {
        opts.bindings += ".node";
      }
      var requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
      var tries = [], i = 0, l = opts.try.length, n, b, err;
      for (; i < l; i++) {
        n = join.apply(
          null,
          opts.try[i].map(function(p) {
            return opts[p] || p;
          })
        );
        tries.push(n);
        try {
          b = opts.path ? requireFunc.resolve(n) : requireFunc(n);
          if (!opts.path) {
            b.path = n;
          }
          return b;
        } catch (e) {
          if (e.code !== "MODULE_NOT_FOUND" && e.code !== "QUALIFIED_PATH_RESOLUTION_FAILED" && !/not find/i.test(e.message)) {
            throw e;
          }
        }
      }
      err = new Error(
        "Could not locate the bindings file. Tried:\n" + tries.map(function(a) {
          return opts.arrow + a;
        }).join("\n")
      );
      err.tries = tries;
      throw err;
    }
    module2.exports = exports2 = bindings;
    exports2.getFileName = function getFileName(calling_file) {
      var origPST = Error.prepareStackTrace, origSTL = Error.stackTraceLimit, dummy = {}, fileName;
      Error.stackTraceLimit = 10;
      Error.prepareStackTrace = function(e, st) {
        for (var i = 0, l = st.length; i < l; i++) {
          fileName = st[i].getFileName();
          if (fileName !== __filename) {
            if (calling_file) {
              if (fileName !== calling_file) {
                return;
              }
            } else {
              return;
            }
          }
        }
      };
      Error.captureStackTrace(dummy);
      dummy.stack;
      Error.prepareStackTrace = origPST;
      Error.stackTraceLimit = origSTL;
      var fileSchema = "file://";
      if (fileName.indexOf(fileSchema) === 0) {
        fileName = fileURLToPath(fileName);
      }
      return fileName;
    };
    exports2.getRoot = function getRoot(file) {
      var dir = dirname(file), prev;
      while (true) {
        if (dir === ".") {
          dir = process.cwd();
        }
        if (exists(join(dir, "package.json")) || exists(join(dir, "node_modules"))) {
          return dir;
        }
        if (prev === dir) {
          throw new Error(
            'Could not find module root given file: "' + file + '". Do you have a `package.json` file? '
          );
        }
        prev = dir;
        dir = join(dir, "..");
      }
    };
  }
});

// node_modules/better-sqlite3/lib/methods/wrappers.js
var require_wrappers = __commonJS({
  "node_modules/better-sqlite3/lib/methods/wrappers.js"(exports2) {
    "use strict";
    var { cppdb } = require_util();
    exports2.prepare = function prepare(sql) {
      return this[cppdb].prepare(sql, this, false);
    };
    exports2.exec = function exec(sql) {
      this[cppdb].exec(sql);
      return this;
    };
    exports2.close = function close() {
      this[cppdb].close();
      return this;
    };
    exports2.loadExtension = function loadExtension(...args) {
      this[cppdb].loadExtension(...args);
      return this;
    };
    exports2.defaultSafeIntegers = function defaultSafeIntegers(...args) {
      this[cppdb].defaultSafeIntegers(...args);
      return this;
    };
    exports2.unsafeMode = function unsafeMode(...args) {
      this[cppdb].unsafeMode(...args);
      return this;
    };
    exports2.getters = {
      name: {
        get: function name() {
          return this[cppdb].name;
        },
        enumerable: true
      },
      open: {
        get: function open() {
          return this[cppdb].open;
        },
        enumerable: true
      },
      inTransaction: {
        get: function inTransaction() {
          return this[cppdb].inTransaction;
        },
        enumerable: true
      },
      readonly: {
        get: function readonly() {
          return this[cppdb].readonly;
        },
        enumerable: true
      },
      memory: {
        get: function memory() {
          return this[cppdb].memory;
        },
        enumerable: true
      }
    };
  }
});

// node_modules/better-sqlite3/lib/methods/transaction.js
var require_transaction = __commonJS({
  "node_modules/better-sqlite3/lib/methods/transaction.js"(exports2, module2) {
    "use strict";
    var { cppdb } = require_util();
    var controllers = /* @__PURE__ */ new WeakMap();
    module2.exports = function transaction(fn) {
      if (typeof fn !== "function") throw new TypeError("Expected first argument to be a function");
      const db2 = this[cppdb];
      const controller = getController(db2, this);
      const { apply } = Function.prototype;
      const properties = {
        default: { value: wrapTransaction(apply, fn, db2, controller.default) },
        deferred: { value: wrapTransaction(apply, fn, db2, controller.deferred) },
        immediate: { value: wrapTransaction(apply, fn, db2, controller.immediate) },
        exclusive: { value: wrapTransaction(apply, fn, db2, controller.exclusive) },
        database: { value: this, enumerable: true }
      };
      Object.defineProperties(properties.default.value, properties);
      Object.defineProperties(properties.deferred.value, properties);
      Object.defineProperties(properties.immediate.value, properties);
      Object.defineProperties(properties.exclusive.value, properties);
      return properties.default.value;
    };
    var getController = (db2, self) => {
      let controller = controllers.get(db2);
      if (!controller) {
        const shared = {
          commit: db2.prepare("COMMIT", self, false),
          rollback: db2.prepare("ROLLBACK", self, false),
          savepoint: db2.prepare("SAVEPOINT `	_bs3.	`", self, false),
          release: db2.prepare("RELEASE `	_bs3.	`", self, false),
          rollbackTo: db2.prepare("ROLLBACK TO `	_bs3.	`", self, false)
        };
        controllers.set(db2, controller = {
          default: Object.assign({ begin: db2.prepare("BEGIN", self, false) }, shared),
          deferred: Object.assign({ begin: db2.prepare("BEGIN DEFERRED", self, false) }, shared),
          immediate: Object.assign({ begin: db2.prepare("BEGIN IMMEDIATE", self, false) }, shared),
          exclusive: Object.assign({ begin: db2.prepare("BEGIN EXCLUSIVE", self, false) }, shared)
        });
      }
      return controller;
    };
    var wrapTransaction = (apply, fn, db2, { begin, commit, rollback, savepoint, release, rollbackTo }) => function sqliteTransaction() {
      let before, after, undo;
      if (db2.inTransaction) {
        before = savepoint;
        after = release;
        undo = rollbackTo;
      } else {
        before = begin;
        after = commit;
        undo = rollback;
      }
      before.run();
      try {
        const result = apply.call(fn, this, arguments);
        if (result && typeof result.then === "function") {
          throw new TypeError("Transaction function cannot return a promise");
        }
        after.run();
        return result;
      } catch (ex) {
        if (db2.inTransaction) {
          undo.run();
          if (undo !== rollback) after.run();
        }
        throw ex;
      }
    };
  }
});

// node_modules/better-sqlite3/lib/methods/pragma.js
var require_pragma = __commonJS({
  "node_modules/better-sqlite3/lib/methods/pragma.js"(exports2, module2) {
    "use strict";
    var { getBooleanOption, cppdb } = require_util();
    module2.exports = function pragma(source, options) {
      if (options == null) options = {};
      if (typeof source !== "string") throw new TypeError("Expected first argument to be a string");
      if (typeof options !== "object") throw new TypeError("Expected second argument to be an options object");
      const simple = getBooleanOption(options, "simple");
      const stmt = this[cppdb].prepare(`PRAGMA ${source}`, this, true);
      return simple ? stmt.pluck().get() : stmt.all();
    };
  }
});

// node_modules/better-sqlite3/lib/methods/backup.js
var require_backup = __commonJS({
  "node_modules/better-sqlite3/lib/methods/backup.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path = require("path");
    var { promisify } = require("util");
    var { cppdb } = require_util();
    var fsAccess = promisify(fs.access);
    module2.exports = async function backup(filename, options) {
      if (options == null) options = {};
      if (typeof filename !== "string") throw new TypeError("Expected first argument to be a string");
      if (typeof options !== "object") throw new TypeError("Expected second argument to be an options object");
      filename = filename.trim();
      const attachedName = "attached" in options ? options.attached : "main";
      const handler = "progress" in options ? options.progress : null;
      if (!filename) throw new TypeError("Backup filename cannot be an empty string");
      if (filename === ":memory:") throw new TypeError('Invalid backup filename ":memory:"');
      if (typeof attachedName !== "string") throw new TypeError('Expected the "attached" option to be a string');
      if (!attachedName) throw new TypeError('The "attached" option cannot be an empty string');
      if (handler != null && typeof handler !== "function") throw new TypeError('Expected the "progress" option to be a function');
      await fsAccess(path.dirname(filename)).catch(() => {
        throw new TypeError("Cannot save backup because the directory does not exist");
      });
      const isNewFile = await fsAccess(filename).then(() => false, () => true);
      return runBackup(this[cppdb].backup(this, attachedName, filename, isNewFile), handler || null);
    };
    var runBackup = (backup, handler) => {
      let rate = 0;
      let useDefault = true;
      return new Promise((resolve, reject) => {
        setImmediate(function step() {
          try {
            const progress = backup.transfer(rate);
            if (!progress.remainingPages) {
              backup.close();
              resolve(progress);
              return;
            }
            if (useDefault) {
              useDefault = false;
              rate = 100;
            }
            if (handler) {
              const ret = handler(progress);
              if (ret !== void 0) {
                if (typeof ret === "number" && ret === ret) rate = Math.max(0, Math.min(2147483647, Math.round(ret)));
                else throw new TypeError("Expected progress callback to return a number or undefined");
              }
            }
            setImmediate(step);
          } catch (err) {
            backup.close();
            reject(err);
          }
        });
      });
    };
  }
});

// node_modules/better-sqlite3/lib/methods/serialize.js
var require_serialize = __commonJS({
  "node_modules/better-sqlite3/lib/methods/serialize.js"(exports2, module2) {
    "use strict";
    var { cppdb } = require_util();
    module2.exports = function serialize(options) {
      if (options == null) options = {};
      if (typeof options !== "object") throw new TypeError("Expected first argument to be an options object");
      const attachedName = "attached" in options ? options.attached : "main";
      if (typeof attachedName !== "string") throw new TypeError('Expected the "attached" option to be a string');
      if (!attachedName) throw new TypeError('The "attached" option cannot be an empty string');
      return this[cppdb].serialize(attachedName);
    };
  }
});

// node_modules/better-sqlite3/lib/methods/function.js
var require_function = __commonJS({
  "node_modules/better-sqlite3/lib/methods/function.js"(exports2, module2) {
    "use strict";
    var { getBooleanOption, cppdb } = require_util();
    module2.exports = function defineFunction(name, options, fn) {
      if (options == null) options = {};
      if (typeof options === "function") {
        fn = options;
        options = {};
      }
      if (typeof name !== "string") throw new TypeError("Expected first argument to be a string");
      if (typeof fn !== "function") throw new TypeError("Expected last argument to be a function");
      if (typeof options !== "object") throw new TypeError("Expected second argument to be an options object");
      if (!name) throw new TypeError("User-defined function name cannot be an empty string");
      const safeIntegers = "safeIntegers" in options ? +getBooleanOption(options, "safeIntegers") : 2;
      const deterministic = getBooleanOption(options, "deterministic");
      const directOnly = getBooleanOption(options, "directOnly");
      const varargs = getBooleanOption(options, "varargs");
      let argCount = -1;
      if (!varargs) {
        argCount = fn.length;
        if (!Number.isInteger(argCount) || argCount < 0) throw new TypeError("Expected function.length to be a positive integer");
        if (argCount > 100) throw new RangeError("User-defined functions cannot have more than 100 arguments");
      }
      this[cppdb].function(fn, name, argCount, safeIntegers, deterministic, directOnly);
      return this;
    };
  }
});

// node_modules/better-sqlite3/lib/methods/aggregate.js
var require_aggregate = __commonJS({
  "node_modules/better-sqlite3/lib/methods/aggregate.js"(exports2, module2) {
    "use strict";
    var { getBooleanOption, cppdb } = require_util();
    module2.exports = function defineAggregate(name, options) {
      if (typeof name !== "string") throw new TypeError("Expected first argument to be a string");
      if (typeof options !== "object" || options === null) throw new TypeError("Expected second argument to be an options object");
      if (!name) throw new TypeError("User-defined function name cannot be an empty string");
      const start = "start" in options ? options.start : null;
      const step = getFunctionOption(options, "step", true);
      const inverse = getFunctionOption(options, "inverse", false);
      const result = getFunctionOption(options, "result", false);
      const safeIntegers = "safeIntegers" in options ? +getBooleanOption(options, "safeIntegers") : 2;
      const deterministic = getBooleanOption(options, "deterministic");
      const directOnly = getBooleanOption(options, "directOnly");
      const varargs = getBooleanOption(options, "varargs");
      let argCount = -1;
      if (!varargs) {
        argCount = Math.max(getLength(step), inverse ? getLength(inverse) : 0);
        if (argCount > 0) argCount -= 1;
        if (argCount > 100) throw new RangeError("User-defined functions cannot have more than 100 arguments");
      }
      this[cppdb].aggregate(start, step, inverse, result, name, argCount, safeIntegers, deterministic, directOnly);
      return this;
    };
    var getFunctionOption = (options, key, required) => {
      const value = key in options ? options[key] : null;
      if (typeof value === "function") return value;
      if (value != null) throw new TypeError(`Expected the "${key}" option to be a function`);
      if (required) throw new TypeError(`Missing required option "${key}"`);
      return null;
    };
    var getLength = ({ length }) => {
      if (Number.isInteger(length) && length >= 0) return length;
      throw new TypeError("Expected function.length to be a positive integer");
    };
  }
});

// node_modules/better-sqlite3/lib/methods/table.js
var require_table = __commonJS({
  "node_modules/better-sqlite3/lib/methods/table.js"(exports2, module2) {
    "use strict";
    var { cppdb } = require_util();
    module2.exports = function defineTable(name, factory) {
      if (typeof name !== "string") throw new TypeError("Expected first argument to be a string");
      if (!name) throw new TypeError("Virtual table module name cannot be an empty string");
      let eponymous = false;
      if (typeof factory === "object" && factory !== null) {
        eponymous = true;
        factory = defer(parseTableDefinition(factory, "used", name));
      } else {
        if (typeof factory !== "function") throw new TypeError("Expected second argument to be a function or a table definition object");
        factory = wrapFactory(factory);
      }
      this[cppdb].table(factory, name, eponymous);
      return this;
    };
    function wrapFactory(factory) {
      return function virtualTableFactory(moduleName, databaseName, tableName, ...args) {
        const thisObject = {
          module: moduleName,
          database: databaseName,
          table: tableName
        };
        const def = apply.call(factory, thisObject, args);
        if (typeof def !== "object" || def === null) {
          throw new TypeError(`Virtual table module "${moduleName}" did not return a table definition object`);
        }
        return parseTableDefinition(def, "returned", moduleName);
      };
    }
    function parseTableDefinition(def, verb, moduleName) {
      if (!hasOwnProperty.call(def, "rows")) {
        throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition without a "rows" property`);
      }
      if (!hasOwnProperty.call(def, "columns")) {
        throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition without a "columns" property`);
      }
      const rows = def.rows;
      if (typeof rows !== "function" || Object.getPrototypeOf(rows) !== GeneratorFunctionPrototype) {
        throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with an invalid "rows" property (should be a generator function)`);
      }
      let columns = def.columns;
      if (!Array.isArray(columns) || !(columns = [...columns]).every((x) => typeof x === "string")) {
        throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with an invalid "columns" property (should be an array of strings)`);
      }
      if (columns.length !== new Set(columns).size) {
        throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with duplicate column names`);
      }
      if (!columns.length) {
        throw new RangeError(`Virtual table module "${moduleName}" ${verb} a table definition with zero columns`);
      }
      let parameters;
      if (hasOwnProperty.call(def, "parameters")) {
        parameters = def.parameters;
        if (!Array.isArray(parameters) || !(parameters = [...parameters]).every((x) => typeof x === "string")) {
          throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with an invalid "parameters" property (should be an array of strings)`);
        }
      } else {
        parameters = inferParameters(rows);
      }
      if (parameters.length !== new Set(parameters).size) {
        throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with duplicate parameter names`);
      }
      if (parameters.length > 32) {
        throw new RangeError(`Virtual table module "${moduleName}" ${verb} a table definition with more than the maximum number of 32 parameters`);
      }
      for (const parameter of parameters) {
        if (columns.includes(parameter)) {
          throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with column "${parameter}" which was ambiguously defined as both a column and parameter`);
        }
      }
      let safeIntegers = 2;
      if (hasOwnProperty.call(def, "safeIntegers")) {
        const bool = def.safeIntegers;
        if (typeof bool !== "boolean") {
          throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with an invalid "safeIntegers" property (should be a boolean)`);
        }
        safeIntegers = +bool;
      }
      let directOnly = false;
      if (hasOwnProperty.call(def, "directOnly")) {
        directOnly = def.directOnly;
        if (typeof directOnly !== "boolean") {
          throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with an invalid "directOnly" property (should be a boolean)`);
        }
      }
      const columnDefinitions = [
        ...parameters.map(identifier).map((str) => `${str} HIDDEN`),
        ...columns.map(identifier)
      ];
      return [
        `CREATE TABLE x(${columnDefinitions.join(", ")});`,
        wrapGenerator(rows, new Map(columns.map((x, i) => [x, parameters.length + i])), moduleName),
        parameters,
        safeIntegers,
        directOnly
      ];
    }
    function wrapGenerator(generator, columnMap, moduleName) {
      return function* virtualTable(...args) {
        const output = args.map((x) => Buffer.isBuffer(x) ? Buffer.from(x) : x);
        for (let i = 0; i < columnMap.size; ++i) {
          output.push(null);
        }
        for (const row of generator(...args)) {
          if (Array.isArray(row)) {
            extractRowArray(row, output, columnMap.size, moduleName);
            yield output;
          } else if (typeof row === "object" && row !== null) {
            extractRowObject(row, output, columnMap, moduleName);
            yield output;
          } else {
            throw new TypeError(`Virtual table module "${moduleName}" yielded something that isn't a valid row object`);
          }
        }
      };
    }
    function extractRowArray(row, output, columnCount, moduleName) {
      if (row.length !== columnCount) {
        throw new TypeError(`Virtual table module "${moduleName}" yielded a row with an incorrect number of columns`);
      }
      const offset = output.length - columnCount;
      for (let i = 0; i < columnCount; ++i) {
        output[i + offset] = row[i];
      }
    }
    function extractRowObject(row, output, columnMap, moduleName) {
      let count = 0;
      for (const key of Object.keys(row)) {
        const index = columnMap.get(key);
        if (index === void 0) {
          throw new TypeError(`Virtual table module "${moduleName}" yielded a row with an undeclared column "${key}"`);
        }
        output[index] = row[key];
        count += 1;
      }
      if (count !== columnMap.size) {
        throw new TypeError(`Virtual table module "${moduleName}" yielded a row with missing columns`);
      }
    }
    function inferParameters({ length }) {
      if (!Number.isInteger(length) || length < 0) {
        throw new TypeError("Expected function.length to be a positive integer");
      }
      const params = [];
      for (let i = 0; i < length; ++i) {
        params.push(`$${i + 1}`);
      }
      return params;
    }
    var { hasOwnProperty } = Object.prototype;
    var { apply } = Function.prototype;
    var GeneratorFunctionPrototype = Object.getPrototypeOf(function* () {
    });
    var identifier = (str) => `"${str.replace(/"/g, '""')}"`;
    var defer = (x) => () => x;
  }
});

// node_modules/better-sqlite3/lib/methods/inspect.js
var require_inspect = __commonJS({
  "node_modules/better-sqlite3/lib/methods/inspect.js"(exports2, module2) {
    "use strict";
    var DatabaseInspection = function Database2() {
    };
    module2.exports = function inspect(depth, opts) {
      return Object.assign(new DatabaseInspection(), this);
    };
  }
});

// node_modules/better-sqlite3/lib/database.js
var require_database = __commonJS({
  "node_modules/better-sqlite3/lib/database.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path = require("path");
    var util = require_util();
    var SqliteError = require_sqlite_error();
    var DEFAULT_ADDON;
    function Database2(filenameGiven, options) {
      if (new.target == null) {
        return new Database2(filenameGiven, options);
      }
      let buffer;
      if (Buffer.isBuffer(filenameGiven)) {
        buffer = filenameGiven;
        filenameGiven = ":memory:";
      }
      if (filenameGiven == null) filenameGiven = "";
      if (options == null) options = {};
      if (typeof filenameGiven !== "string") throw new TypeError("Expected first argument to be a string");
      if (typeof options !== "object") throw new TypeError("Expected second argument to be an options object");
      if ("readOnly" in options) throw new TypeError('Misspelled option "readOnly" should be "readonly"');
      if ("memory" in options) throw new TypeError('Option "memory" was removed in v7.0.0 (use ":memory:" filename instead)');
      const filename = filenameGiven.trim();
      const anonymous = filename === "" || filename === ":memory:";
      const readonly = util.getBooleanOption(options, "readonly");
      const fileMustExist = util.getBooleanOption(options, "fileMustExist");
      const timeout = "timeout" in options ? options.timeout : 5e3;
      const verbose = "verbose" in options ? options.verbose : null;
      const nativeBinding = "nativeBinding" in options ? options.nativeBinding : null;
      if (readonly && anonymous && !buffer) throw new TypeError("In-memory/temporary databases cannot be readonly");
      if (!Number.isInteger(timeout) || timeout < 0) throw new TypeError('Expected the "timeout" option to be a positive integer');
      if (timeout > 2147483647) throw new RangeError('Option "timeout" cannot be greater than 2147483647');
      if (verbose != null && typeof verbose !== "function") throw new TypeError('Expected the "verbose" option to be a function');
      if (nativeBinding != null && typeof nativeBinding !== "string" && typeof nativeBinding !== "object") throw new TypeError('Expected the "nativeBinding" option to be a string or addon object');
      let addon;
      if (nativeBinding == null) {
        addon = DEFAULT_ADDON || (DEFAULT_ADDON = require_bindings()("better_sqlite3.node"));
      } else if (typeof nativeBinding === "string") {
        const requireFunc = typeof __non_webpack_require__ === "function" ? __non_webpack_require__ : require;
        addon = requireFunc(path.resolve(nativeBinding).replace(/(\.node)?$/, ".node"));
      } else {
        addon = nativeBinding;
      }
      if (!addon.isInitialized) {
        addon.setErrorConstructor(SqliteError);
        addon.isInitialized = true;
      }
      if (!anonymous && !filename.startsWith("file:") && !fs.existsSync(path.dirname(filename))) {
        throw new TypeError("Cannot open database because the directory does not exist");
      }
      Object.defineProperties(this, {
        [util.cppdb]: { value: new addon.Database(filename, filenameGiven, anonymous, readonly, fileMustExist, timeout, verbose || null, buffer || null) },
        ...wrappers.getters
      });
    }
    var wrappers = require_wrappers();
    Database2.prototype.prepare = wrappers.prepare;
    Database2.prototype.transaction = require_transaction();
    Database2.prototype.pragma = require_pragma();
    Database2.prototype.backup = require_backup();
    Database2.prototype.serialize = require_serialize();
    Database2.prototype.function = require_function();
    Database2.prototype.aggregate = require_aggregate();
    Database2.prototype.table = require_table();
    Database2.prototype.loadExtension = wrappers.loadExtension;
    Database2.prototype.exec = wrappers.exec;
    Database2.prototype.close = wrappers.close;
    Database2.prototype.defaultSafeIntegers = wrappers.defaultSafeIntegers;
    Database2.prototype.unsafeMode = wrappers.unsafeMode;
    Database2.prototype[util.inspect] = require_inspect();
    module2.exports = Database2;
  }
});

// node_modules/better-sqlite3/lib/index.js
var require_lib = __commonJS({
  "node_modules/better-sqlite3/lib/index.js"(exports2, module2) {
    "use strict";
    module2.exports = require_database();
    module2.exports.SqliteError = require_sqlite_error();
  }
});

// src/database.ts
var import_better_sqlite3 = __toESM(require_lib());
var DB_PATH = "./crm.db";
var db = null;
function initDB() {
  if (db) return db;
  try {
    console.log(`[DB INITIALIZATION] Opening database at ${DB_PATH}...`);
    db = new import_better_sqlite3.default(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    console.log("\u2705 [DB INITIALIZATION] SQLite connection active (WAL Mode).");
    return db;
  } catch (err) {
    console.error("\u274C [DB INITIALIZATION] Failed to initialize SQLite:", err);
    throw err;
  }
}
function migrate(database) {
  console.log("[DB] Running migrations...");
  database.exec(`
        CREATE TABLE IF NOT EXISTS contacts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            address TEXT,
            tags TEXT,
            source TEXT,
            service TEXT,
            status TEXT NOT NULL CHECK(status IN ('lead', 'customer', 'lost')),
            notes TEXT,
            created_at TEXT NOT NULL,
            invalid_phone INTEGER DEFAULT 0,
            lead_status TEXT,
            follow_up_required INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS opportunities (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            contact_id TEXT NOT NULL,
            pipeline_stage TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('open', 'won', 'lost')),
            value REAL DEFAULT 0,
            source TEXT,
            notes TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (contact_id) REFERENCES contacts (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            contact_id TEXT NOT NULL,
            opportunity_id TEXT,
            direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
            type TEXT NOT NULL,
            content TEXT NOT NULL,
            status TEXT NOT NULL,
            source TEXT,
            retryable INTEGER DEFAULT 1,
            provider_message_id TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (contact_id) REFERENCES contacts (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS calls (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            contact_id TEXT,
            opportunity_id TEXT,
            phone TEXT NOT NULL,
            direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
            status TEXT NOT NULL,
            duration INTEGER DEFAULT 0,
            recording_url TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (contact_id) REFERENCES contacts (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS event_logs (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            event_name TEXT NOT NULL,
            payload TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS activities (
            id TEXT PRIMARY KEY,
            contact_id TEXT NOT NULL,
            type TEXT NOT NULL,
            description TEXT NOT NULL,
            due_date TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            FOREIGN KEY (contact_id) REFERENCES contacts (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS website_settings (
            id TEXT PRIMARY KEY,
            business_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT NOT NULL,
            logo_url TEXT,
            primary_color TEXT,
            facebook_pixel_id TEXT,
            gtm_id TEXT,
            auto_lead_sms_enabled INTEGER DEFAULT 1,
            auto_lead_sms_template TEXT,
            missed_call_sms_enabled INTEGER DEFAULT 1,
            missed_call_sms_template TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    `);
  try {
    database.prepare("ALTER TABLE contacts ADD COLUMN user_id TEXT NOT NULL DEFAULT 'system'").run();
    console.log("\u2705 [DB MIGRATION] Added user_id to contacts table");
  } catch (e) {
  }
  try {
    database.prepare("ALTER TABLE opportunities ADD COLUMN user_id TEXT NOT NULL DEFAULT 'system'").run();
    console.log("\u2705 [DB MIGRATION] Added user_id to opportunities table");
  } catch (e) {
  }
  try {
    database.prepare("ALTER TABLE messages ADD COLUMN user_id TEXT NOT NULL DEFAULT 'system'").run();
    console.log("\u2705 [DB MIGRATION] Added user_id to messages table");
  } catch (e) {
  }
  try {
    database.prepare("ALTER TABLE calls ADD COLUMN user_id TEXT NOT NULL DEFAULT 'system'").run();
    console.log("\u2705 [DB MIGRATION] Added user_id to calls table");
  } catch (e) {
  }
  try {
    database.prepare("ALTER TABLE event_logs ADD COLUMN user_id TEXT NOT NULL DEFAULT 'system'").run();
    console.log("\u2705 [DB MIGRATION] Added user_id to event_logs table");
  } catch (e) {
  }
  console.log("\u2705 [DB] Migrations completed: contacts, opportunities, messages, calls, event_logs, activities, website_settings, and users initialized.");
}
function getDB() {
  if (!db) {
    return initDB();
  }
  return db;
}
function closeDB() {
  if (db) {
    db.close();
    db = null;
    console.log("[DB] SQLite connection closed.");
  }
}

// src/website_settings_repo.ts
var DEFAULT_SETTINGS = {
  id: "global-settings",
  business_name: "Acme Home Services",
  phone: "+15550000000",
  email: "hello@acmehome.com",
  logo_url: "https://placehold.co/150x50/000000/FFFFFF?text=ACME",
  primary_color: "#2563eb",
  facebook_pixel_id: "",
  gtm_id: "",
  auto_lead_sms_enabled: true,
  auto_lead_sms_template: "Hi {name}, thanks for contacting {business_name}. How can we help you?",
  missed_call_sms_enabled: true,
  missed_call_sms_template: "Hi {name}, sorry we missed your call to {business_name}. We'll call back shortly. Can we help you over text?",
  created_at: (/* @__PURE__ */ new Date()).toISOString()
};
function persistWebsiteSettings(settings) {
  const db2 = getDB();
  const stmt = db2.prepare(`
    INSERT OR REPLACE INTO website_settings (
      id, business_name, phone, email, logo_url, primary_color,
      facebook_pixel_id, gtm_id, auto_lead_sms_enabled, auto_lead_sms_template,
      missed_call_sms_enabled, missed_call_sms_template, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    settings.id || "global-settings",
    settings.business_name,
    settings.phone,
    settings.email,
    settings.logo_url || null,
    settings.primary_color || null,
    settings.facebook_pixel_id || null,
    settings.gtm_id || null,
    settings.auto_lead_sms_enabled ? 1 : 0,
    settings.auto_lead_sms_template,
    settings.missed_call_sms_enabled ? 1 : 0,
    settings.missed_call_sms_template,
    settings.created_at || (/* @__PURE__ */ new Date()).toISOString()
  );
  return settings;
}
function getWebsiteSettings() {
  const db2 = getDB();
  const stmt = db2.prepare("SELECT * FROM website_settings WHERE id = 'global-settings' LIMIT 1");
  const row = stmt.get();
  if (!row) {
    persistWebsiteSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
  return {
    ...row,
    auto_lead_sms_enabled: row.auto_lead_sms_enabled === 1,
    missed_call_sms_enabled: row.missed_call_sms_enabled === 1
  };
}

// src/calls_repo.ts
function persistCall(call) {
  const db2 = getDB();
  db2.prepare(`
        INSERT OR REPLACE INTO calls (
            id, user_id, contact_id, opportunity_id, phone, direction, status, duration, recording_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
    call.id,
    call.user_id,
    call.contact_id || null,
    call.opportunity_id || null,
    call.phone,
    call.direction,
    call.status,
    call.duration || 0,
    call.recording_url || null,
    call.created_at
  );
  return call;
}
function getCall(id) {
  const db2 = getDB();
  const row = db2.prepare("SELECT * FROM calls WHERE id = ?").get(id);
  if (!row) return null;
  return row;
}

// src/messages_repo.ts
function persistMessage(message) {
  const db2 = getDB();
  const existing = db2.prepare("SELECT id FROM messages WHERE id = ?").get(message.id);
  if (existing) {
    db2.prepare(`
            UPDATE messages SET
                status = ?,
                retryable = ?,
                provider_message_id = ?
            WHERE id = ?
        `).run(
      message.status,
      message.retryable ? 1 : 0,
      message.provider_message_id || null,
      message.id
    );
  } else {
    db2.prepare(`
            INSERT INTO messages (
                id, user_id, contact_id, opportunity_id, direction, type, content, 
                status, source, retryable, provider_message_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
      message.id,
      message.user_id,
      message.contact_id,
      message.opportunity_id || null,
      message.direction,
      message.type,
      message.content,
      message.status,
      message.source || null,
      message.retryable ? 1 : 0,
      message.provider_message_id || null,
      message.created_at
    );
  }
  return message;
}
function updateMessageStatus(id, status, providerMessageId, retryable) {
  const db2 = getDB();
  db2.prepare(`
        UPDATE messages SET
            status = ?,
            provider_message_id = ?,
            retryable = ?
        WHERE id = ?
    `).run(
    status,
    providerMessageId || null,
    retryable ? 1 : 0,
    id
  );
}
function countRecentOutboundMessages(contactId, sinceIso) {
  const db2 = getDB();
  const result = db2.prepare(`
        SELECT count(*) as total FROM messages 
        WHERE contact_id = ? AND direction = 'outbound' AND created_at > ?
    `).get(contactId, sinceIso);
  return result.total;
}
function checkDuplicateMessage(contactId, content, sinceIso) {
  const db2 = getDB();
  const result = db2.prepare(`
        SELECT id FROM messages 
        WHERE contact_id = ? AND direction = 'outbound' AND content = ? AND created_at > ?
        LIMIT 1
    `).get(contactId, content, sinceIso);
  return !!result;
}

// src/contacts_repo.ts
function persistContact(contact) {
  const db2 = getDB();
  console.log(`[DB: CONTACT] Persisting ${contact.id} (${contact.name}). follow_up_required: ${contact.follow_up_required}`);
  const stmt = db2.prepare(`
    INSERT INTO contacts (
        id, user_id, name, phone, email, address, tags, source, service, status, notes, created_at, invalid_phone, lead_status, follow_up_required
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        name = excluded.name,
        phone = excluded.phone,
        email = excluded.email,
        address = excluded.address,
        tags = excluded.tags,
        source = excluded.source,
        service = excluded.service,
        status = excluded.status,
        notes = excluded.notes,
        created_at = excluded.created_at,
        invalid_phone = excluded.invalid_phone,
        lead_status = excluded.lead_status,
        follow_up_required = excluded.follow_up_required
  `);
  stmt.run(
    contact.id,
    contact.user_id,
    contact.name,
    contact.phone,
    contact.email,
    contact.address,
    JSON.stringify(contact.tags || []),
    contact.source,
    contact.service || null,
    contact.status,
    contact.notes || null,
    contact.created_at,
    contact.invalid_phone ? 1 : 0,
    contact.lead_status || null,
    contact.follow_up_required ? 1 : 0
  );
  return contact;
}
function findContact(phone, email) {
  const db2 = getDB();
  const stmt = db2.prepare(`
    SELECT * FROM contacts 
    WHERE (phone = ? AND phone != '') 
       OR (email = ? AND email != '')
    LIMIT 1
  `);
  const row = stmt.get(phone, email);
  if (!row) return null;
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    invalid_phone: !!row.invalid_phone,
    follow_up_required: !!row.follow_up_required
  };
}
function getContact(id) {
  const db2 = getDB();
  const stmt = db2.prepare("SELECT * FROM contacts WHERE id = ?");
  const row = stmt.get(id);
  if (!row) return null;
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    invalid_phone: !!row.invalid_phone,
    follow_up_required: !!row.follow_up_required
  };
}

// src/opportunities_repo.ts
function persistOpportunity(opportunity) {
  const db2 = getDB();
  const stmt = db2.prepare(`
    INSERT OR REPLACE INTO opportunities (
        id, user_id, contact_id, pipeline_stage, status, value, source, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    opportunity.id,
    opportunity.user_id,
    opportunity.contact_id,
    opportunity.pipeline_stage,
    opportunity.status,
    opportunity.value || 0,
    opportunity.source || null,
    opportunity.notes || null,
    opportunity.created_at
  );
  return opportunity;
}
function getOpportunitiesByContact(contact_id) {
  const db2 = getDB();
  const stmt = db2.prepare("SELECT * FROM opportunities WHERE contact_id = ? ORDER BY created_at DESC");
  const rows = stmt.all(contact_id);
  return rows.map((row) => ({
    ...row,
    status: row.status,
    value: parseFloat(row.value) || 0
  }));
}
function getOpportunity(id) {
  const db2 = getDB();
  const stmt = db2.prepare("SELECT * FROM opportunities WHERE id = ?");
  const row = stmt.get(id);
  if (!row) return null;
  return {
    ...row,
    status: row.status,
    value: parseFloat(row.value) || 0
  };
}

// src/event_logs_repo.ts
function persistEventLog(log) {
  const db2 = getDB();
  db2.prepare(`
        INSERT OR REPLACE INTO event_logs (
            id, user_id, event_name, payload, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
    log.id,
    log.user_id,
    log.event_name,
    JSON.stringify(log.payload || {}),
    log.status,
    log.created_at
  );
  return log;
}
function getAllEventLogs() {
  const db2 = getDB();
  const rows = db2.prepare("SELECT * FROM event_logs ORDER BY created_at ASC").all();
  return rows.map((row) => ({
    ...row,
    payload: JSON.parse(row.payload)
  }));
}

// src/config.ts
var import_meta = {};
var twilioConfig = {
  account_sid: typeof import_meta !== "undefined" && import_meta.env?.VITE_TWILIO_ACCOUNT_SID || typeof process !== "undefined" && process.env.VITE_TWILIO_ACCOUNT_SID || "",
  auth_token: typeof import_meta !== "undefined" && import_meta.env?.VITE_TWILIO_AUTH_TOKEN || typeof process !== "undefined" && process.env.VITE_TWILIO_AUTH_TOKEN || "",
  sending_phone_number: typeof import_meta !== "undefined" && import_meta.env?.VITE_TWILIO_PHONE_NUMBER || typeof process !== "undefined" && process.env.VITE_TWILIO_PHONE_NUMBER || ""
};
var authConfig = {
  // If in browser, use VITE_ variable. In Node (tests), use process.env. Default to 'dev_secret' for easy testing.
  jwt_secret: typeof import_meta !== "undefined" && import_meta.env?.VITE_JWT_SECRET || typeof process !== "undefined" && process.env.JWT_SECRET || "antigravity_safe_default_secret_123"
};

// src/messages.ts
function saveMessage(message) {
  const contact = getContact(message.contact_id);
  if (!contact) {
    console.error(`[Message Error] Invalid contact_id: ${message.contact_id}`);
    return false;
  }
  if (!message.opportunity_id) {
    const opps = getOpportunitiesByContact(message.contact_id);
    const latestOpp = opps.filter((o) => o.status === "open").sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (latestOpp) {
      message.opportunity_id = latestOpp.id;
    }
  }
  const finalMessage = {
    id: message.id || `msg-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    user_id: message.user_id || contact.user_id || "system",
    contact_id: message.contact_id,
    opportunity_id: message.opportunity_id,
    direction: message.direction || "outbound",
    type: message.type || "sms",
    content: message.content || "",
    status: message.status || "pending",
    source: message.source,
    created_at: message.created_at || (/* @__PURE__ */ new Date()).toISOString()
  };
  persistMessage(finalMessage);
  console.log(`[Message Saved]: ${finalMessage.id} with status "${finalMessage.status}" for contact ${finalMessage.contact_id}`);
  return true;
}
function getAllMessagesOrdered() {
  const db2 = getDB();
  const rows = db2.prepare("SELECT * FROM messages ORDER BY created_at ASC").all();
  const messages = rows.map((row) => ({
    ...row,
    retryable: row.retryable === 1
  }));
  return messages;
}

// src/sms.ts
function getDefaultLeadReply(contact, template) {
  const name = contact?.name?.trim() || "";
  if (template && template.trim()) {
    return template.replace(/{name}/g, name || "there");
  }
  const greeting = name ? `Hey ${name}` : "Hey there";
  return `${greeting}, thanks for reaching out! I got your request and will get back to you shortly.`;
}
function getMissedCallReply(contact, template) {
  const name = (contact?.name?.trim() || "").replace("Unknown Caller", "");
  if (template && template.trim()) {
    return template.replace(/{name}/g, name || "there");
  }
  if (!name) {
    return "Hey, sorry I missed your call. How can I help?";
  }
  return `Hey ${name}, sorry I missed your call. How can I help?`;
}
async function sendSMS(phone, message) {
  const { account_sid, auth_token, sending_phone_number } = twilioConfig;
  if (!account_sid || !auth_token || !sending_phone_number) {
    const errorMsg = "Twilio credentials not fully configured in environment variables.";
    console.error(`[SMS SERVICE] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`;
  const auth = btoa(`${account_sid}:${auth_token}`);
  const params = new URLSearchParams();
  params.append("To", phone);
  params.append("From", sending_phone_number);
  params.append("Body", message);
  try {
    console.log(`[SMS SERVICE] Attempting to send message to ${phone}...`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    const data = await response.json();
    if (response.ok) {
      console.log(`\u2705 [SMS SERVICE] Message successfully dispatched. Twilio SID: ${data.sid}`);
      return {
        success: true,
        provider_message_id: data.sid
      };
    } else {
      const errorDetail = data.message || response.statusText;
      console.error(`\u274C [SMS SERVICE] Dispatch failed: ${errorDetail}`);
      return {
        success: false,
        error: errorDetail
      };
    }
  } catch (error) {
    console.error(`\u274C [SMS SERVICE] Network or Runtime Error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
async function dispatchSMS(contact_id, phone, messageText, opportunity_id, source, user_id) {
  const newMessage = {
    id: `msg-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    user_id,
    // Will be resolved by saveMessage if missing
    contact_id,
    opportunity_id,
    direction: "outbound",
    type: "sms",
    content: messageText,
    status: "pending",
    source,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  saveMessage(newMessage);
  console.log(`[DISPATCH] Message record created with status "pending": ${newMessage.id}`);
  const result = await sendSMS(phone, messageText);
  if (result.success) {
    updateMessageStatus(newMessage.id, "sent", result.provider_message_id, false);
    console.log(`\u2705 [DISPATCH] Message ${newMessage.id} marked as 'sent'. Provider ID: ${result.provider_message_id}`);
  } else {
    updateMessageStatus(newMessage.id, "failed", void 0, true);
    console.error(`\u274C [DISPATCH] Message ${newMessage.id} marked as 'failed'. Error: ${result.error}`);
  }
  return {
    internal_id: newMessage.id,
    twilio_result: result
  };
}
async function sendMessageToContact(contact_id, messageText, source, user_id) {
  const contact = getContact(contact_id);
  if (!contact) {
    const errorMsg = `Contact lookup failed: ID ${contact_id} not found in database.`;
    console.error(`[CONTACT HELPER] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
  if (!contact.phone) {
    const errorMsg = `SMS Aborted: Contact ${contact.name} (${contact_id}) has no phone number recorded.`;
    console.error(`[CONTACT HELPER] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
  const sinceIso = new Date(Date.now() - 6e4).toISOString();
  const isDuplicate = checkDuplicateMessage(contact_id, messageText, sinceIso);
  if (isDuplicate) {
    const errorMsg = `Duplicate SMS prevented`;
    console.warn(`[CONTACT HELPER] ${errorMsg}: '${messageText}' was already sent to ${contact.name} within the last 60 seconds.`);
    return { success: false, error: errorMsg };
  }
  const recentMessagesCount = countRecentOutboundMessages(contact_id, sinceIso);
  if (recentMessagesCount >= 3) {
    const errorMsg = `Rate limit hit`;
    console.warn(`[CONTACT HELPER] ${errorMsg}: Contact ${contact.name} has already received 3 messages in the last minute.`);
    return { success: false, error: errorMsg };
  }
  console.log(`[CONTACT HELPER] Initializing SMS lifecycle for ${contact.name}...`);
  const result = await dispatchSMS(contact_id, contact.phone, messageText, void 0, source, user_id);
  return {
    success: result.twilio_result.success,
    internal_id: result.internal_id,
    error: result.twilio_result.error
  };
}

// src/events.ts
var listeners = {};
function onEvent(name, callback) {
  if (!listeners[name]) {
    listeners[name] = [];
  }
  listeners[name].push(callback);
}
function createEvent(name, payload = {}) {
  return {
    event_name: name,
    payload,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function emitEvent(name, payload = {}, user_id) {
  if (name === "form_submitted" || name === "lead_created") {
    if (!payload.contact_id || !payload.opportunity_id) {
      console.error("Invalid event payload", { event_name: name, payload });
      return null;
    }
  }
  let finalUserId = user_id;
  if (!finalUserId) {
    if (payload.contact_id) {
      const contact = getContact(payload.contact_id);
      if (contact) finalUserId = contact.user_id;
    } else if (payload.opportunity_id) {
      const opp = getOpportunity(payload.opportunity_id);
      if (opp) finalUserId = opp.user_id;
    }
  }
  const event = createEvent(name, payload);
  const logEntry = {
    id: `ev-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    user_id: finalUserId || "system",
    event_name: event.event_name,
    payload: event.payload,
    status: "pending",
    created_at: event.created_at
  };
  persistEventLog(logEntry);
  logEntry.status = "processed";
  persistEventLog(logEntry);
  console.log("[Event Logged]:", event);
  if (listeners[name]) {
    for (const fn of listeners[name]) {
      try {
        await fn(payload);
      } catch (e) {
        console.error(`[Event Listener Error] ${name}:`, e);
      }
    }
  }
  return event;
}
onEvent("lead_created", async (payload) => {
  const settings = getWebsiteSettings();
  if (!settings.auto_lead_sms_enabled) {
    console.log("Automated lead SMS skipped: auto-response disabled globally");
    return;
  }
  console.log("Lead created event received");
  const contact_id = payload.contact_id;
  let phone = payload.phone;
  if (!phone && contact_id) {
    const contact2 = getContact(contact_id);
    if (contact2 && contact2.phone) {
      phone = contact2.phone;
    }
  }
  if (!phone) {
    console.log("Automated lead SMS skipped: No phone available");
    return;
  }
  const contact = getContact(contact_id);
  if (!contact) {
    console.log("Contact not found for SMS");
    return;
  }
  const template = settings.auto_lead_sms_template;
  const message = getDefaultLeadReply(contact, template);
  const sinceIso = new Date(Date.now() - 12e4).toISOString();
  const alreadySent = checkDuplicateMessage(contact_id, message, sinceIso);
  if (alreadySent) {
    console.log("Automated lead SMS skipped: duplicate prevented");
    return;
  }
  console.log(`[AUTOMATION] Triggering automated SMS for lead: ${contact.name}`);
  try {
    const result = await sendMessageToContact(contact_id, message, "automation");
    if (result.success) {
      console.log("Automated lead SMS sent");
    } else {
      console.log(`Auto SMS failed: ${result.error}`);
      contact.follow_up_required = true;
      persistContact(contact);
    }
  } catch (err) {
    console.error(`\u274C [AUTOMATION ERROR] lead_created listener failed: ${err.message}`);
    contact.follow_up_required = true;
    persistContact(contact);
  }
});
onEvent("call_missed", async (payload) => {
  console.log("call_missed event received");
  const settings = getWebsiteSettings();
  if (!settings.missed_call_sms_enabled) {
    console.log("Missed call SMS disabled");
    return;
  }
  const { phone, call_id } = payload;
  if (!phone) {
    console.log("[SMS PREP] No phone provided, exiting");
    return;
  }
  const phoneNorm = normalizePhone(phone);
  const existingContact = findContact(phoneNorm.normalized, null);
  let contactIdToUse;
  if (existingContact) {
    console.log(`Contact matched: ${existingContact.name} (${existingContact.id})`);
    contactIdToUse = existingContact.id;
  } else {
    const newContact = {
      id: `c-${Date.now()}`,
      user_id: "system",
      name: "Unknown Caller",
      phone: phoneNorm.normalized,
      email: null,
      address: "New lead from missed call",
      tags: ["missed-call"],
      source: "missed_call",
      status: "lead",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    persistContact(newContact);
    console.log("New contact created from missed call");
    contactIdToUse = newContact.id;
  }
  const targetContact = getContact(contactIdToUse);
  if (!targetContact) {
    console.log("[SMS PREP] No contact resolved, exiting");
    return;
  }
  console.log(`[SMS PREP] Target contact resolved: ${targetContact.name} (${targetContact.id})`);
  const smsMessage = getMissedCallReply(targetContact, settings.missed_call_sms_template);
  const twoMinutesAgo = new Date(Date.now() - 12e4).toISOString();
  const alreadySentMC = checkDuplicateMessage(targetContact.id, smsMessage, twoMinutesAgo);
  if (alreadySentMC) {
    console.log("Missed call SMS already sent");
    console.log(`[SMS SKIPPED] Prevented duplicate follow-up within 2-minute window for ${targetContact.name}`);
    return;
  }
  const fiveMinAgo = new Date(Date.now() - 3e5).toISOString();
  const recentCount = countRecentOutboundMessages(targetContact.id, fiveMinAgo);
  if (recentCount >= 2) {
    console.log("Missed call SMS rate limited");
    console.warn(`[SMS SKIPPED] Rate limit of 2 messages reached within 5 minutes for ${targetContact.name}`);
    return;
  }
  console.log(`[SMS PREP] Message prepared: "${smsMessage}"`);
  const smsResult = await sendMessageToContact(targetContact.id, smsMessage, "missed_call_automation");
  if (smsResult.success) {
    console.log("Missed call SMS sent");
    console.log(`[SMS SUCCESS] Automated reply sent to ${targetContact.name}: "${smsMessage}"`);
  } else if (smsResult.error === "Duplicate SMS prevented" || smsResult.error === "Rate limit hit") {
    console.log("Missed call SMS skipped");
    console.warn(`[SMS SKIPPED] ${smsResult.error} for ${targetContact.name}`);
  } else {
    console.log("Missed call SMS failed");
    console.error(`[SMS FAILURE] Could not send reply to ${targetContact.name}: ${smsResult.error}`);
    targetContact.follow_up_required = true;
    persistContact(targetContact);
  }
  const newOpportunity = {
    id: `opp-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    user_id: targetContact?.user_id || "system",
    contact_id: contactIdToUse,
    pipeline_stage: "New Lead",
    status: "open",
    value: 0,
    source: "missed_call",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  persistOpportunity(newOpportunity);
  console.log(`Opportunity created for contact ${contactIdToUse}`);
  if (call_id) {
    const callRecord = getCall(call_id);
    if (callRecord) {
      callRecord.contact_id = contactIdToUse;
      callRecord.opportunity_id = newOpportunity.id;
      callRecord.user_id = targetContact?.user_id || "system";
      persistCall(callRecord);
      console.log(`Call record ${call_id} linked to contact ${contactIdToUse} and opportunity ${newOpportunity.id}`);
    }
  }
});

// src/db.ts
var mockActivities = [
  {
    id: "a1",
    contact_id: "c2",
    type: "call",
    description: "Initial follow-up call about driveway cleaning",
    due_date: "2026-03-02T09:00:00Z",
    completed: true
  },
  {
    id: "a2",
    contact_id: "c2",
    type: "sms",
    description: "Sent quote via text",
    due_date: "2026-03-05T10:00:00Z",
    completed: false
  }
];
var mockTemplates = [
  {
    id: "tpl1",
    name: "Standard Landing Page",
    category: "Landing Pages",
    sections: [
      {
        type: "hero",
        content: { heading: "Welcome to our Service", subheading: "The best experience you ever had." },
        styles: { padding: "100px 20px", background: "#f8fafc", text_alignment: "center" },
        order: 1
      },
      {
        type: "text",
        content: { heading: "Our Features", body: "Discover why thousands of users trust us every day." },
        styles: { padding: "60px 20px", background: "#ffffff" },
        order: 2
      },
      {
        type: "form",
        content: { title: "Contact Us", fields: ["name", "email", "message"] },
        styles: { padding: "60px 20px", background: "#f8fafc" },
        order: 3
      }
    ],
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "tpl-generic",
    name: "Generic Service Template",
    category: "Landing Pages",
    sections: [
      {
        type: "hero",
        content: { heading: "", subheading: "", button_text: "" },
        styles: { padding: "100px 20px", background: "#f8fafc", text_alignment: "center" },
        order: 1
      },
      {
        type: "text",
        content: { heading: "Our Service", text: "" },
        styles: { padding: "60px 20px", background: "#ffffff" },
        order: 2
      },
      {
        type: "text",
        content: { heading: "Key Benefits", text: "" },
        styles: { padding: "60px 20px", background: "#f1f5f9" },
        order: 3
      },
      {
        type: "text",
        content: { heading: "Frequently Asked Questions", text: "" },
        styles: { padding: "60px 20px", background: "#ffffff" },
        order: 4
      }
    ],
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "tpl-quote-funnel",
    name: "Quote Funnel Template",
    category: "conversion",
    sections: [
      {
        type: "hero",
        content: { heading: "Expert Exterior Cleaning", subheading: "Professional pressure washing for your home or business.", button_text: "See Our Services" },
        styles: { padding: "100px 20px", background: "#f8fafc", text_alignment: "center" },
        order: 1
      },
      {
        type: "cta",
        content: { heading: "Quick Price Check", subheading: "Need an estimate fast? Fill out our form below.", button_text: "Jump to Form" },
        styles: { padding: "60px 20px", cta_background: "#f1f5f9" },
        order: 2
      },
      {
        type: "form",
        content: { title: "Request Your Free Quote", fields: ["name", "phone", "address", "service_type", "message"] },
        styles: { padding: "80px 20px", background: "#ffffff" },
        order: 3
      },
      {
        type: "text",
        content: {
          heading: "Trusted by local homeowners",
          text: '<p style="text-align: center; max-width: 800px; margin: 0 auto;">We have helped over 500 families protect and beautify their homes with professional results and a local touch. Our specialized equipment ensures a deep clean without damaging your surfaces.</p>'
        },
        styles: { padding: "60px 20px", background: "#f8fafc" },
        order: 4
      },
      {
        type: "cta",
        content: { heading: "Start Your Project Today", subheading: "Professional results are just a click away.", button_text: "Get Started Now" },
        styles: { padding: "100px 20px", cta_background: "#4f46e5" },
        order: 5
      }
    ],
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  }
];
var mockWebsiteSettings = {
  id: "settings-001",
  business_name: "Handyman Hans Pressure Washing",
  phone: "555-0199",
  email: "hans@example.com",
  logo_url: "https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?q=80&w=200&h=200&auto=format&fit=crop",
  primary_color: "#4f46e5",
  facebook_pixel_id: "",
  gtm_id: "",
  auto_lead_sms_enabled: true,
  auto_lead_sms_template: "Hey {name}, thanks for reaching out! I'll get back to you ASAP.",
  missed_call_sms_enabled: true,
  missed_call_sms_template: "",
  created_at: (/* @__PURE__ */ new Date()).toISOString()
};

// src/automation.ts
var automations = [
  {
    id: "a1",
    name: "Auto-follow task for new leads",
    trigger: "OPPORTUNITY_CREATED",
    action: "CREATE_TASK",
    actionParams: {
      type: "call",
      description: "Call new lead ASAP",
      dueInMinutes: 10
    }
  },
  {
    id: "a2",
    name: "Notify when job is scheduled",
    trigger: "OPPORTUNITY_STAGE_UPDATED",
    condition: (context) => context.pipeline_stage === "Scheduled",
    action: "SEND_NOTIFICATION",
    actionParams: {
      message: "\u{1F389} A job has been scheduled! Get ready."
    }
  },
  {
    id: "a3",
    name: "Final follow up when completed",
    trigger: "OPPORTUNITY_STAGE_UPDATED",
    condition: (context) => context.pipeline_stage === "Completed",
    action: "CREATE_TASK",
    actionParams: {
      type: "visit",
      description: "Site cleanup & final inspection",
      dueInDays: 0
    }
  },
  {
    id: "a4",
    name: "Follow up on sent quote",
    trigger: "OPPORTUNITY_STAGE_UPDATED",
    condition: (context) => context.pipeline_stage === "Quote Sent",
    action: "CREATE_TASK",
    actionParams: {
      type: "note",
      description: "Follow up on quote in 24 hours",
      dueInDays: 1
    }
  }
];
function runAutomations(trigger, context) {
  const activeAutomations = automations.filter(
    (a) => a.trigger === trigger && (!a.condition || a.condition(context))
  );
  activeAutomations.forEach((automation) => {
    executeAction(automation, context);
  });
}
function executeAction(automation, context) {
  switch (automation.action) {
    case "CREATE_TASK":
      createTaskAction(automation.actionParams, context);
      break;
    case "SEND_NOTIFICATION":
      sendNotificationAction(automation.actionParams, context);
      break;
  }
}
function createTaskAction(params, context) {
  const contact = getContact(context.contact_id);
  const contactName = contact ? contact.name : "Unknown";
  const dueDate = /* @__PURE__ */ new Date();
  if (params.dueInDays) {
    dueDate.setDate(dueDate.getDate() + params.dueInDays);
  }
  if (params.dueInMinutes) {
    dueDate.setMinutes(dueDate.getMinutes() + params.dueInMinutes);
  }
  const newTask = {
    id: "task-" + Date.now() + "-" + Math.floor(Math.random() * 1e3),
    contact_id: context.contact_id,
    type: params.type || "note",
    description: params.description || `[AUTOMATED] Follow up for ${contactName}`,
    due_date: dueDate.toISOString(),
    completed: false
  };
  mockActivities.push(newTask);
  console.log(`[AUTOMATION: TASK CREATED] ${newTask.description}`);
}
function sendNotificationAction(params, context) {
  const contact = getContact(context.contact_id);
  const contactName = contact ? contact.name : "Unknown";
  const message = params.message.replace("${contactName}", contactName);
  console.log(`%c[AUTOMATION: NOTIFICATION] ${message} (${contactName})`, "color: #007bff; font-weight: bold;");
  if (typeof window !== "undefined") {
    alert(`Automation Notification: ${message}`);
  }
}

// src/leads_logic.ts
function normalizePhone(phone) {
  if (!phone) return { normalized: "", invalid: true };
  const cleaned = phone.replace(/[\s\-\(\)\[\]\{\}\.\,\/]/g, "").replace(/\D/g, "");
  if (cleaned.length === 10) {
    return { normalized: `+1${cleaned}`, invalid: false };
  } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return { normalized: `+${cleaned}`, invalid: false };
  }
  return { normalized: cleaned || phone, invalid: true };
}
function normalizeEmail(email) {
  if (!email || !email.trim()) return null;
  return email.trim().toLowerCase();
}
function normalizeName(name) {
  if (!name) return "";
  return name.trim().replace(/\s\s+/g, " ");
}
async function createLead(data, request) {
  const user_id = request?.user?.id || "system";
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const phoneNorm = normalizePhone(data.phone || "");
  const emailNorm = normalizeEmail(data.email);
  const normalizedName = normalizeName(data.name);
  if (!normalizedName) {
    throw new Error("Name is required for lead creation.");
  }
  const existingContact = findContact(phoneNorm.normalized, emailNorm);
  let contactIdToUse;
  if (existingContact) {
    contactIdToUse = existingContact.id;
    console.log(`Duplicate lead found: using existing contact ${contactIdToUse}.`);
    const contactOpps = getOpportunitiesByContact(contactIdToUse);
    const recentOpp = contactOpps.find(
      (opp) => (/* @__PURE__ */ new Date()).getTime() - new Date(opp.created_at).getTime() < 12e4
    );
    if (recentOpp) {
      throw new Error(`Duplicate submission window open for contact ${contactIdToUse}.`);
    }
  } else {
    contactIdToUse = `c-${Date.now()}`;
    const newContact = {
      id: contactIdToUse,
      user_id,
      name: normalizedName,
      phone: phoneNorm.normalized,
      email: emailNorm,
      address: data.address || "Lead API Submission",
      tags: ["web-lead"],
      source: data.source || "api",
      service: data.service_type || void 0,
      status: "lead",
      created_at: timestamp,
      invalid_phone: phoneNorm.invalid
    };
    persistContact(newContact);
  }
  const newOpportunity = {
    id: `opp-${Date.now()}`,
    user_id: existingContact ? existingContact.user_id || "system" : user_id,
    contact_id: contactIdToUse,
    pipeline_stage: "New Lead",
    value: 0,
    assigned_to: "Unassigned",
    status: "open",
    notes: `Service Type: ${data.service_type || "N/A"}
Address: ${data.address || "N/A"}
Message: ${data.message || "N/A"}`,
    source: data.source || "api",
    created_at: timestamp
  };
  persistOpportunity(newOpportunity);
  const emissionsInThisCycle = /* @__PURE__ */ new Set();
  const guardedEmit = (name, payload) => {
    if (!emissionsInThisCycle.has(name)) {
      emitEvent(name, payload);
      emissionsInThisCycle.add(name);
    }
  };
  guardedEmit("lead_created", {
    contact_id: contactIdToUse,
    opportunity_id: newOpportunity.id,
    phone: phoneNorm.normalized,
    email: emailNorm,
    pipeline_stage: "New Lead",
    source: data.source || "api"
  });
  runAutomations("OPPORTUNITY_CREATED", newOpportunity);
  return {
    contactId: contactIdToUse,
    opportunityId: newOpportunity.id,
    status: "success"
  };
}

// src/calls_logic.ts
async function handleInboundCall(data) {
  if (!data || !data.phone) {
    const errorMsg = "Phone number is required for inbound call.";
    console.error(`[API ERROR] ${errorMsg}`);
    throw new Error(errorMsg);
  }
  const phoneNorm = normalizePhone(data.phone);
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  console.log(`Inbound call received from ${phoneNorm.normalized}`);
  const existingContact = findContact(phoneNorm.normalized, null);
  const callRecord = {
    id: `call-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    user_id: existingContact?.user_id || "system",
    phone: phoneNorm.normalized,
    direction: "inbound",
    status: "received",
    created_at: timestamp
  };
  persistCall(callRecord);
  await emitEvent("call_received", {
    phone: phoneNorm.normalized,
    source: "mock_call",
    timestamp
  });
  return {
    status: "received",
    phone: phoneNorm.normalized,
    callId: callRecord.id,
    // Helpful to return the record ID
    timestamp
  };
}
async function endCall(data) {
  if (!data || !data.call_id) {
    throw new Error("call_id is required to end a call.");
  }
  const call = getCall(data.call_id);
  if (!call) {
    const errorMsg = `Call with ID ${data.call_id} not found.`;
    console.error(`[API ERROR] ${errorMsg}`);
    throw new Error(errorMsg);
  }
  if (call.status === "answered" || call.status === "missed") {
    console.log(`Call already processed: ${call.status}`);
    return {
      status: "ignored",
      callId: call.id,
      currentStatus: call.status,
      message: "Call already processed"
    };
  }
  call.status = data.answered ? "answered" : "missed";
  call.duration = data.answered ? 60 : 0;
  persistCall(call);
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  console.log(`Call ended: ${call.status}`);
  if (!data.answered) {
    await emitEvent("call_missed", {
      phone: call.phone,
      call_id: call.id,
      timestamp
    });
  }
  return {
    status: "updated",
    callId: call.id,
    newStatus: call.status,
    timestamp
  };
}

// verify_phase3_ownership.ts
async function verifyOwnership() {
  console.log("--- PHASE 3 VERIFICATION: User Ownership & Inheritance ---");
  initDB();
  const mockUser = {
    id: "user_123",
    email: "test@owner.com",
    password_hash: "HASH",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  const mockRequest = {
    user: mockUser
  };
  try {
    console.log("\n[TEST 1] Lead Creation Ownership");
    const lead = await createLead({
      name: "Ownership Explorer",
      phone: "+15550001234",
      email: "owner@explorer.com",
      source: "web_form"
    }, mockRequest);
    const contact = getContact(lead.contactId);
    if (!contact) throw new Error("Contact not created");
    console.log(`- Contact user_id: ${contact.user_id}`);
    if (contact.user_id !== "user_123") throw new Error("Contact user_id mismatch");
    const opps = getOpportunitiesByContact(lead.contactId);
    const opp = opps[0];
    if (!opp) throw new Error("Opportunity not created");
    console.log(`- Opportunity user_id: ${opp.user_id}`);
    if (opp.user_id !== "user_123") throw new Error("Opportunity user_id mismatch with request user");
    if (opp.user_id !== contact.user_id) throw new Error("Opportunity ownership mismatch with contact");
    console.log("\u2705 PASS TEST 1: Lead and Opportunity correctly owned by the authenticated user.");
    console.log("\n[TEST 2] Message Resolution from Contact");
    const sms = await sendMessageToContact(lead.contactId, "Hello from the system!", "automation");
    if (!sms.success) throw new Error("SMS failed to send in mock mode");
    const messages = getAllMessagesOrdered().filter((m) => m.contact_id === lead.contactId);
    const latestMsg = messages[messages.length - 1];
    console.log(`- Message user_id: ${latestMsg.user_id}`);
    if (latestMsg.user_id !== "user_123") throw new Error("Message failed to resolve owner from contact");
    console.log("\u2705 PASS TEST 2: System-triggered messages correctly resolve ownership from the contact.");
    console.log("\n[TEST 3] Call Ownership Sync");
    const callTargetPhone = "+15559998888";
    const leadB = await createLead({
      name: "Call Owner",
      phone: callTargetPhone,
      email: "call@owner.com"
    }, { user: { ...mockUser, id: "user_456" } });
    console.log(`- Lead B created with owner: user_456 (Contact: ${leadB.contactId})`);
    const inbound = await handleInboundCall({ phone: callTargetPhone });
    console.log(`- Inbound call created from ${callTargetPhone}. Call ID: ${inbound.callId}`);
    const callBeforeLink = getDB().prepare("SELECT * FROM calls WHERE id = ?").get(inbound.callId);
    console.log(`- Initial Call owner: ${callBeforeLink.user_id}`);
    if (callBeforeLink.user_id !== "user_456") throw new Error("Inbound call failed to immediately resolve owner from contact phone");
    await endCall({ call_id: inbound.callId, answered: false });
    const callAfterLink = getDB().prepare("SELECT * FROM calls WHERE id = ?").get(inbound.callId);
    console.log(`- Post-link Call owner: ${callAfterLink.user_id}`);
    if (callAfterLink.user_id !== "user_456") throw new Error("Inbound call ownership lost/mismatched during processing");
    console.log("\u2705 PASS TEST 3: Calls correctly identify and persist ownership based on contact matching.");
    console.log("\n[TEST 4] Event Log Ownership inheritance");
    const logs = getAllEventLogs().filter((l) => l.payload.contact_id === lead.contactId);
    if (logs.length === 0) throw new Error("No logs found for Lead A");
    console.log(`- Event: ${logs[0].event_name}, owner: ${logs[0].user_id}`);
    if (logs[0].user_id !== "user_123") throw new Error("Event log failed to inherit ownership from contact payload");
    console.log("\u2705 PASS TEST 4: Event logs are correctly user-scoped via entity payload resolution.");
    console.log("\n--- ALL OWNERSHIP VERIFICATIONS PASSED ---");
  } catch (err) {
    console.error("\n\u274C VERIFICATION FAILED:", err);
    if (typeof process !== "undefined") process.exit(1);
  } finally {
    closeDB();
  }
}
verifyOwnership();
