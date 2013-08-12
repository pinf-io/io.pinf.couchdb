
const PATH = require("path");
const FS = require("fs");
const COMMANDER = require("commander");
const SPAWN = require("child_process").spawn;
const EXEC = require("child_process").exec;
const PINF = require("pinf-for-nodejs");
const PORTFINDER = require("portfinder");


PINF.main(function(context, callback) {

    var pidPath = context.makePath("run", "couchdb.pid");
    var stdoutPath = context.makePath("log", "couchdb.stdout.log");
    var stderrPath = context.makePath("log", "couchdb.stderr.log");
    var configPath = context.makePath("tmp", "couchdb.ini");

    function getConfig(readOnly, callback) {
        if (typeof readOnly === "function" && typeof callback === "undefined") {
            callback = readOnly;
            readOnly = false;
        }
        function format(err, config) {
            if (err) return callback(err);
            if (!config) return callback(null, {});
            // Derive pinf format from couchdb format.
            return callback(null, {
                "io": {
                    "port": config.httpd.port
                }
            }, config);
        }
        return PORTFINDER.getPort(function (err, port) {
            if (err) return callback(err);
            // Keep original config in couchdb format.
            // @see http://docs.couchdb.org/en/latest/configuring.html
            var defaultConfig = {};
            var overrideConfig = {
                "httpd": {
                    "port": port
                }
            };
            return context.ensureRuntimeConfig("couchdb", defaultConfig, overrideConfig, {
                write: !readOnly
            }, format);
        });
    }

    function resetConfig(callback) {
        return context.ensureRuntimeConfig("couchdb", {}, {
            "httpd": {
                "port": null
            }
        }, callback);
    }

    function ensureConfigFile(callback) {
        return getConfig(function (err, pinfConfig, couchdbConfig) {
            if (err) return callback(err);
            return FS.writeFile(configPath, [
                "[httpd]",
                "port = " + couchdbConfig.httpd.port
            ].join("\n"), callback);
        });
    }

    function removeConfigFile(callback) {
        return resetConfig(function(err) {
            if (err) return callback(err);
            return FS.unlink(configPath, function(err) {
                if (err) return callback(err);
                return callback(null);
            });
        });
    }

    function waitUntil(running, done) {
        var callback = function() {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
            return done.apply(null, arguments);
        };
        var timeoutId = setTimeout(function() {
            return callback(new Error("CouchDB did not start within time."));
        }, 5 * 1000);
        var intervalId = setInterval(function() {
            return exports.isRunning(function(err, status) {
                if (err) return callback(err);
                if (!!status === !!running) return callback(null);
                // Nothing more to do in this interval.
            });
        }, 1 * 1000);
    }


    exports.isRunning = function(callback) {
        return FS.exists(configPath, function(exists) {
            if (!exists) return callback(null, false);
            return EXEC('couchdb -a "' + configPath + '" -p "' + pidPath + '" -s', function (err, stdout, stderr) {
                var m = stdout.match(/Apache CouchDB is running as process (\d+), time to relax./);
                if (m) return callback(null, parseInt(m[1]));
                return callback(null, false);  
            });
        });
    }

    exports.config = function(callback) {
        return getConfig(true, function(err, pinfConfig, couchdbConfig) {
            if (err) return callback(err);
            return callback(null, {
                pinf: pinfConfig,
                couchdb: couchdbConfig
            });
        });
    }

    exports.start = function (callback) {
        return ensureConfigFile(function(err) {
            if (err) return callback(err);
            var child = SPAWN("couchdb", [
                "-b",
                "-a", configPath,
                "-p", pidPath,
                "-o", stdoutPath,
                "-e", stderrPath
            ], {
                detached: true,
                stdio: [
                    "ignore",
                    FS.openSync(context.makePath("log", "couchdb.start.stdout.log"), "a"),
                    FS.openSync(context.makePath("log", "couchdb.start.stderr.log"), "a")
                ]
            });
            child.unref();
            return waitUntil(true, callback);
        });
    }

    exports.stop = function (callback) {
        return ensureConfigFile(function(err) {
            if (err) return callback(err);
            var child = SPAWN("couchdb", [
                "-d",
                "-a", configPath,
                "-p", pidPath
            ], {
                detached: true,
                stdio: [
                    "ignore",
                    FS.openSync(context.makePath("log", "couchdb.stop.stdout.log"), "a"),
                    FS.openSync(context.makePath("log", "couchdb.stop.stderr.log"), "a")
                ]
            });
            child.unref();
            return waitUntil(false, function(err) {
                if (err) return callback(err);
                return removeConfigFile(callback);
            });
        });
    }


    var program = new COMMANDER.Command();

    program
        .version(JSON.parse(FS.readFileSync(PATH.join(__dirname, "package.json"))).version)
        .option("-v, --verbose", "Show verbose progress.");

    var acted = false;

    program
        .command("start")
        .description("Start")
        .action(function() {
            acted = true;
            return exports.start(callback);
        });

    program
        .command("stop")
        .description("Stop")
        .action(function() {
            acted = true;
            return exports.stop(callback);
        });

    program
        .command("config")
        .description("Config")
        .action(function() {
            acted = true;
            return exports.config(function(err, config) {
                if (err) return callback(err);
                process.stdout.write(JSON.stringify(config, null, 4) + "\n");
                return callback(null);
            });
        });

    program
        .command("status")
        .description("Status")
        .action(function() {
            acted = true;
            return exports.isRunning(function(err, running) {
                if (err) return callback(err);
                console.log("Running: " + ((running)?"Yes (pid: " + running + ")":"No"));
                return callback(null);
            });
        });

    program.parse(process.argv);

    if (!acted) {
        console.error(("ERROR: Command '" + process.argv.slice(2).join(" ") + "' not found!").error);
        program.outputHelp();
        return callback(true);
    }

}, module);
