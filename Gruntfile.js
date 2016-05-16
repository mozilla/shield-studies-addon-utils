

module.exports = function(grunt) {
    var istanbulJpm = require("istanbul-jpm");
    // gross, put this in the process
    process.env.coveragedir = require("os").tmpdir();
    grunt.initConfig({
        shell: {
            jpmTest: {
                command: 'jpm test',
            }
        },
        instrument: {
            files: 'lib/**/*.js',
            options: {
                lazy: false,
                basePath: 'coverage/instrument',
                instrumenter: istanbulJpm.Instrumenter
            }
        },
        storeCoverage: {
            options: {
                dir: 'coverage/reports'
            }
        },
        makeReport: {
            src: 'coverage/reports/**/*.json',
            options: {
                type: 'lcov',
                dir: 'coverage/reports',
                print: 'detail'
            }
        }
    });


    grunt.loadNpmTasks('grunt-babel');
    grunt.loadNpmTasks('grunt-shell');
    grunt.loadNpmTasks('grunt-istanbul');

    grunt.registerTask('readcoverageglobal', 'Reads the coverage global JPM wrote', function() {
        global.__coverage__ = require("istanbul-jpm/global-node").global.__coverage__;
        grunt.log.ok("Read __coverage__ global");
    });

    //grunt.registerTask('test', ['babel', 'instrument', 'shell:jpmTest', 'readcoverageglobal', 'storeCoverage', 'makeReport']);
    grunt.registerTask('test', ['instrument', 'shell:jpmTest', 'readcoverageglobal', 'storeCoverage', 'makeReport']);

};




