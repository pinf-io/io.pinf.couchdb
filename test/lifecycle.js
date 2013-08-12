
const ASSERT = require("assert");
const PATH = require("path");
const EXEC = require("child_process").exec;


describe("lifecycle", function() {

    this.timeout(10 * 1000);


    it("status", function(done) {
        return call(["status"], function(err, stdout) {
            if (err) return done(err);
            if (!/Running: No/.test(stdout)) {
                return done(new Error("CouchDB running at beginning of test. TODO: Grap a random port and PID file every time couchdb starts up."));
            }
            return done();
        });
    });

    it("config", function(done) {
        return call(["config"], function(err, stdout) {
            if (err) return done(err);
            var config = JSON.parse(stdout);
            ASSERT.equal(typeof config.pinf.io.port, "number");
            return done();
        });
    });

    it("start", function(done) {
        return call(["start"], function(err, stdout) {
            if (err) return done(err);
            return done();
        });
    });

    it("status", function(done) {
        return call(["status"], function(err, stdout) {
            if (err) return done(err);
            if (!/Running: Yes \(pid: \d+\)/.test(stdout)) {
                return done(new Error("CouchDB did not start."));
            }
            return done();
        });
    });

    it("config", function(done) {
        return call(["config"], function(err, stdout) {
            if (err) return done(err);
            var config = JSON.parse(stdout);
            ASSERT.equal(typeof config.pinf.io.port, "number");
            return done();
        });
    });

    it("stop", function(done) {
        return call(["stop"], function(err, stdout) {
            if (err) return done(err);
            return done();
        });
    });

    it("status", function(done) {
        return call(["status"], function(err, stdout) {
            if (err) return done(err);
            if (!/Running: No/.test(stdout)) {
                return done(new Error("CouchDB running at end of test."));
            }
            return done();
        });
    });

    it("config", function(done) {
        return call(["config"], function(err, stdout) {
            if (err) return done(err);
            var config = JSON.parse(stdout);
            ASSERT.equal(typeof config.pinf.io.port, "number");
            return done();
        });
    });


    function call(args, callback) {

        var env = {};
        for (var name in process.env) {
            env[name] = process.env[name];
        }
        env.PINF_RUNTIME = PATH.join(__dirname, ".rt/program.rt.json");

        return EXEC("node " + PATH.join(__dirname, "../io") + " " + args.join(" "), {
            env: env
        }, function (err, stdout, stderr) {
            if (err) return callback(err);
            return callback(null, stdout);
        });
    }

});
