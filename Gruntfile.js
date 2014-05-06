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
        jshint: {
            options: {
                jshintrc: '.jshintrc'
            },
            all: [
                'Gruntfile.js',
                'lib/**/*.js'
            ],
            specs: {
                options: {
                    jshintrc: 'spec/.jshintrc'
                },
                files: [{
                    src: ['spec/**/*.js']
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

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-mocha-test');

    grunt.registerTask('test', ['mochaTest']);

    grunt.registerTask('default', ['jshint', 'test']);
};
