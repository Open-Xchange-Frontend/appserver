'use strict';

module.exports = function (grunt) {
    grunt.initConfig({
        watch: {
            options: {
                interrupt: true,
                spawn: true
            },
            all: {
                files: ['spec/**/*', 'lib/**/*.js', 'Gruntfile.js'],
                tasks: ['jshint', 'test']
            }
        },
        eslint: {
            all: {
                files: [{
                    expand: true,
                    src: [
                        'Gruntfile.js', 'lib/**/*.js', 'spec/**/*.js'
                    ],
                    filter: 'isFile'
                }]
            }
        },
        mochaTest: {
            tests: {
                src: 'spec/**/*_spec.js',
                options: {
                    reporter: 'spec'
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-mocha-test');

    grunt.registerTask('test', ['mochaTest']);

    grunt.registerTask('default', ['eslint', 'test']);
};
