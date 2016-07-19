

module.exports = function(grunt) {
    var istanbulJpm = require("istanbul-jpm");
    // gross, put this in the process
    process.env.coveragedir = require("os").tmpdir();
    grunt.initConfig({
        eslint: {
            files: '{,lib/,test/,example/lib/, example/test/}*.js'
        },
        shell: {
            jpmTest: {
                command: 'jpm test',
            },
            jpmTestTravis: {
                command: 'jpm test -b /usr/local/bin/firefox',
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


    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-babel');
    grunt.loadNpmTasks('grunt-shell');
    grunt.loadNpmTasks('grunt-istanbul');

    grunt.registerTask('readcoverageglobal', 'Reads the coverage global JPM wrote', function() {
        global.__coverage__ = require("istanbul-jpm/global-node").global.__coverage__;
        grunt.log.ok("Read __coverage__ global");
    });

    if (process.env.TRAVIS) {
        grunt.log.ok("testing with travis path for fx");
        grunt.registerTask('test', ['eslint', 'instrument', 'shell:jpmTestTravis', 'readcoverageglobal', 'storeCoverage', 'makeReport']);
    } else {
        grunt.registerTask('test', ['eslint', 'instrument', 'shell:jpmTest', 'readcoverageglobal', 'storeCoverage', 'makeReport']);
    }
};




