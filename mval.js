module.exports = (function() {

    'use strict';

    var fs = require('fs'),
        semver = require('semver'),

        /**
         * Returns an array with validation faults
         * @param {String|Object} input
         * @param {String} type
         * @retrun {Array|Boolean}
         */
        validateManifest = function(input, type) {
            var faults = [];
            if( typeof input != 'string' ) {
                faults = faults.concat( findInvalidValues(input) );
            }

            switch(type) {
                case MANIFEST.JQUERY:
                    faults = faults.concat(validateJquery(input));
                    break;
                case MANIFEST.COMPOSER:
                    faults = faults.concat(validateComposer(input));
                    break;
                case MANIFEST.WORDPRESS:
                    faults = faults.concat(validateWordpress(input));
                    break;
                case MANIFEST.NPM:
                    faults = faults.concat(validateNPM(input));
                    break;
                default:
                    throw new Error('Unknown type '+type);
            }

            return faults;
        },

        /**
         * Validate composer manifest
         * @return {Array}
         */
        validateComposer = function(obj) {
            var faults = findFields(['name', 'description'], obj);

            if( obj.keywords && !(obj.keywords instanceof Array) ) {
                faults.push('Field "keyword" has to be an array');
            }

            faults = faults.concat(findInvalidURLs(['homepage', 'demo', 'bugs'], obj));

            if( obj.time &&
                obj.time.match(/^(\d{4})\-(\d{2})\-(\d{2})$/) === null &&
                obj.time.match(/^(\d{4})\-(\d{2})\-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/) === null
                ) {
                faults.push('Field "time" does not seem to have a correct date format (YYYY-MM-DD)')
            }

            var version = obj.version && obj.version.indexOf('-') ? obj.version.substr(0, obj.version.indexOf('-')) : obj.version;
            if( !semver.valid(obj.version) ) {
                faults.push('Field "version" does not have a valid version');
            }

            faults = faults.concat(findInvalidVersions(obj.require));
            faults = faults.concat(findInvalidVersions(obj.replace));
            faults = faults.concat(findInvalidVersions(obj['require-dev']));

            return faults;
        },

        /**
         * Validate jquery manifest
         * @return {Array}
         */
        validateJquery = function(obj) {
            var error = findFields(['name', 'title', 'author', 'licenses', 'dependencies'], obj);

            if( obj.name.toLowerCase().indexOf('jquery') > - 1) {
                error.push('Name is not allowed to contain "jQuery"');
            }
            if( obj.licenses && typeof obj.licenses[0].length == 0 ) {
                error.push('Licenses is missing');
            }
            if( !semver.valid(obj.version) ) {
                error.push('Field "version" does not have a valid version');
            }

            error = error.concat( findInvalidVersions(obj.dependencies) );
            error = error.concat( findInvalidVersions(obj.devDependencies) );
            error = error.concat( findInvalidURLs(['homepage', 'demo', 'bugs'], obj) );

            if( obj.keywords && !(obj.keywords instanceof Array) ) {
                error.push('Field "keywords" has to be an array');
            }

            return error;
        },

        /**
         * @param {Object} obj
         * @return {Array}
         */
        validateNPM = function(obj) {
            var error = findFields(['name', 'description', 'version', 'engine', 'author'], obj);

            error = error.concat( findInvalidVersions(obj.dependencies) );
            error = error.concat( findInvalidVersions(obj.devDependencies) );
            var engine = obj.engine || '';
            var engineVersion = engine.substr(engine.indexOf(' '), engine.length).trim();

            if( engine && !semver.validRange(engineVersion) ) {
                error.push('Field "engine" does not have a valid version');
            }
            if( obj.version && !semver.valid(obj.version) ) {
                error.push('Field "version" does not have a valid version');
            }

            return error;
        },

        /**
         * @param {String} fileContent
         * @return {Array}
         */
        validateWordpress = function(fileContent) {

        },

        /**
         * Supported manifest types
         */
        MANIFEST = {
            JQUERY : '.jquery.json',
            COMPOSER : 'composer.json',
            WORDPRESS : 'readme.txt',
            NPM : 'package.json'
        },

        /**
         * @param {String} file
         * @param {String} type
         * @return {String|Object}
         */
        loadFile = function(file, type) {
            var content = fs.readFileSync(file);
            if( type !== MANIFEST.WORDPRESS ) {
                try {
                    return JSON.parse(content);
                } catch(e) {
                    throw new Error('Unable to parse JSON');
                }
            }
            return content;
        },

        /**
         * @param {Object} obj
         */
        findInvalidVersions = function(obj) {
            var error = [];
            if(obj !== undefined) {
                for(var plugin in obj) {
                    if( obj.hasOwnProperty(plugin) ) {
                        var version = obj[plugin];
                        if( !semver.validRange(version) )
                            error.push('Version number "'+version+'" for "'+plugin+'" is not a valid version');
                    }
                }
            }
            return error;
        },

        /**
         * Returns those fields that are missing
         * @param {Array} fields
         * @param {Object} obj
         * @return {Array}
         */
        findFields = function(fields, obj) {
            var missing = [];
            fields.every(function(f) {
                if( typeof obj[f] == 'undefined' )
                    missing.push('Field "'+f+'" is missing');
                return true;
            });
            return missing;
        },

        /**
         * @param {Object} obj
         * @return {Boolean}
         */
        findInvalidValues = function(obj) {
            var invalid = [];

            Object.keys(obj).forEach(function(key) {
                var val = obj[key];
                if( val instanceof Array || typeof val == 'object' ) {
                    invalid = invalid.concat(findInvalidValues(val));
                }
                else if(key == 'email' && !isEmail(val)) {
                    invalid.push('Incorrect e-mail "'+val+'"');
                }
                else if( (key == 'url' || key == 'homepage') && !isURL(val)) {
                    invalid.push('Incorrect URL "'+val+'"');
                }
            });

            return invalid;
        },

        /**
         * Find those fields that exists in the object but has an invalid URL
         * @param {Array} fields
         * @param {Object} obj
         * @return {Array}
         */
        findInvalidURLs = function(fields, obj) {
            var invalid = [];
            fields.every(function(val) {
                if( obj[val] !== undefined && obj[val].length > 0 && !isURL(obj[val]) ) {
                    invalid.push('Field "'+val+'" contains invalid url');
                }
                return true;
            });
            return invalid;
        },

        /**
         * @param {String} email
         * @return {Boolean}
         */
        isEmail = function(email) {
            var emailFilter = /^([a-zA-Z0-9_\.\-])+@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
            return emailFilter.test(email);
        },

        /**
         * @param {String} URL
         * @return {Boolean}
         */
        isURL = function(URL) {
            var urlFilter = /^(https|http|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|\[|\]|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i;
            if( urlFilter.test(URL) ) {
                var domain = URL.split('://')[1].split('/')[0];
                var topDomain = domain.substr(domain.lastIndexOf('.')+1, domain.length);
                if( topDomain.length < 2 || (topDomain.length > 3 && ['coop', 'info', 'museum', 'name', 'mobi'].indexOf(topDomain) == -1)) {
                    return false;
                }
            }

            return true;
        },

        /**
         * @param {String} file
         * @return {String|Boolean}
         */
        getManifestTypeFromFile = function(file) {
            var type = false;
            for (var x in MANIFEST) {
                if( MANIFEST.hasOwnProperty(x) ) {
                    if( file.indexOf( MANIFEST[x] ) !== -1 ) {
                        type = MANIFEST[x];
                        break;
                    }
                }
            }
            return type;
        };

    return {

        /**
         * Returns an array with validation faults
         * @param {String|Object} arg Either path to file or manifest object
         * @param {String} [type] Either 'jquery', 'npm', 'composer' or 'wordpress' (MANIFEST)
         * @return {Boolean} Returns an array with validation faults
         */
        validate : function(arg, type) {
            var isFile = false;
            try {
                isFile = fs.statSync(arg).isFile();
            } catch(e) {}

            if ( isFile ) {

                if( !type ) {
                    type = getManifestTypeFromFile(arg);
                    if( !type ) {
                        throw new Error('Unable to determine type from file name, please supply a type');
                    }
                }

                var content;
                try {
                    content = loadFile(arg, type);
                } catch(e) {
                    throw new Error('Unable to parse JSON using '+arg);
                }

                return validateManifest(content, type);

            } else {

                if( typeof arg != 'object' )
                    throw new Error('Argument has to be an object or path to file that should be validated');
                if( !type )
                    throw new Error('Argument type has to be given');

                return validateManifest(arg, type);
            }
        },

        MANIFEST : MANIFEST,

        getManifestTypeFromFile : getManifestTypeFromFile
    };

})();