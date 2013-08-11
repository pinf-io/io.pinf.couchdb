
const PATH = require("path");
const FS = require("fs");
const COMMANDER = require("commander");
const SPAWN = require("child_process").spawn;
const EXEC = require("child_process").exec;
const PINF = require("pinf-for-nodejs");

PINF.main(function(context, callback) {

    var pidPath = context.makePath("run", "couchdb.pid");
    var stdoutPath = context.makePath("log", "couchdb.stdout.log");
    var stderrPath = context.makePath("log", "couchdb.stderr.log");


    exports.isRunning = function(callback) {
        return EXEC('couchdb -p "' + pidPath + '" -s', function (err, stdout, stderr) {
            var m = stdout.match(/Apache CouchDB is running as process (\d+), time to relax./);
            if (m) return callback(null, parseInt(m[1]));
            return callback(null, false);  
        });
    }

    exports.start = function (callback) {
        var child = SPAWN("couchdb", [
            "-b",
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
        // TODO: Wait for couchdb to be up by calling `isRunning()` and/or better before returning.
        return callback(null);
    }

    exports.stop = function () {
        var child = SPAWN("couchdb", [
            "-d",
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
        // TODO: Wait for couchdb to be up by calling `isRunning()` and/or better before returning.
        return callback(null);
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
