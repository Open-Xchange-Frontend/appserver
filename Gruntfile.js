'use strict';

module.exports = function (grunt) {
    grunt.initConfig({
        watch: {
            options: {
                interrupt: true,
                spawn: true
            },
            all: {
                files: ['lib/**/*.js', 'Gruntfile.js'],
                tasks: ['jshint']
            }
        },
        jshint: {
            options: {
                jshintrc: '.jshintrc'
            },
            all: [
                'Gruntfile.js',
                'lib/**/*.js'
            ]
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('default', ['jshint']);
};
