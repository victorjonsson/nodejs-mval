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
                    faults = faults.concat(validateWordpressReadme(input));
                    break;
                case MANIFEST.NPM:
                    faults = faults.concat(validateNPM(input));
                    break;
                case MANIFEST.ANDROID:
                    faults = faults.concat(validateAndroidManifest(input));
                    break;
                default:
                    throw new Error('Unknown type '+type);
            }

            return faults;
        },

        /**
         * @param {String} input
         * @return {Array}
         */
        validateAndroidManifest = function( input ) {
            var faults = [];
            try {
                var xmlDoc = require("libxmljs").parseXml(input);
                if( xmlDoc.error ) {
                    throw new Error(xmlDoc.error);
                }
            } catch(e) {
                return ['Invalid XML, parse failed ('+ e.message +')'];
            }

            var attr = xmlDoc.root().attrs();
            Object.keys(attr).forEach(function(k, name) {
                if(attr[k].name() == 'versionName' && !semver.valid(attr[k].value())) {
                    faults.push('Manifest attribute android:versionName does not contain a valid version');
                }
            });

            if(xmlDoc.find('application').length != 1) {
                faults.push('The manifest has to contain exactly one node named "application"');
            }
            else {

                var validateBool = function(val) {
                    return val == 'true' || val == 'false';
                };
                var validationScheme = {
                    'name' : function(val) {
                                return /^[a-zA-Z0-9\.\_]*$/.test(val);
                            },
                    'mimeType' : function(val) {
                                var parts = val.split('/');
                                return parts.length == 2 && /^[a-zA-Z0-9\_]*$/.test(parts[0]) && /^[a-zA-Z0-9\_]*$/.test(parts[1])
                            },
                    'scheme' : function(val) {
                                var colonPos = val.indexOf(':');
                                return /^[a-z\:]*$/.test(val) && (colonPos == -1 || val.substr(-1) == ':');
                            },
                    'port' : function(val) {
                            return /^[0-9]*$/.test(val);
                        },
                    'hardwareAccelerated' : validateBool,
                    'syncable' : validateBool,
                    'excludeFromRecents' : validateBool,
                    'exported' : validateBool
                };

                // todo: add more validations...

                var validateAttributeValues = function(nodeName) {
                    xmlDoc.find(nodeName).forEach(function(attrNode, v) {
                        for(var attrName in validationScheme ) {
                            if( validationScheme.hasOwnProperty(attrName) && typeof validationScheme[attrName] == 'function' ) {
                                var attr = attrNode.attr(attrName);
                                if( attr && !validationScheme[attrName](attr.value()) ) {
                                    faults.push('Element '+nodeName+' contains invalid value "'+attr.value()+'" in attribute "'+attrName+'"');
                                }
                               /* else if( attr ) {
                                    console.log(attrName);
                                } */
                            }
                        }
                    });
                };

                validateAttributeValues('uses-permission');
                validateAttributeValues('application/activity');
                validateAttributeValues('application/activity/intent-filter/category');
                validateAttributeValues('application/activity/intent-filter/action');
                validateAttributeValues('application/activity/intent-filter/data');
                validateAttributeValues('application/provider');
                validateAttributeValues('application/service');
                validateAttributeValues('application/service/intent-filter/data');
                validateAttributeValues('application/service/intent-filter/category');
                validateAttributeValues('application/service/intent-filter/action');
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
            if( !semver.valid(obj.version) && obj.version != 'dev-master' ) {
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
        validateWordpressReadme = function(fileContent) {
            var error = [];
            var testedUpTo = getWPArg(fileContent, 'Tested up to') +'.0';
            if( !isValidWPVersion(testedUpTo) )
                error.push('Parameter "Tested up to" does not have a valid version');

            var requires = getWPArg(fileContent, 'Requires at least');
            if( !isValidWPVersion(requires) )
                error.push('Parameter "Requires at least" does not have a valid version');

            var stableTag = getWPArg(fileContent, 'Stable tag');
            if( !isValidWPVersion(stableTag) )
                error.push('Parameter "Stable tag" does not have a valid version');

            ['License URI', 'Donate link', 'Plugin URI', 'Author URI'].every(function(param) {
                var val = getWPArg(fileContent, param);
                if( val && !isURL(val) ) {
                    error.push('"'+param+'" is not valid');
                }
                return true;
            });

            return error;
        },

        /**
         * @param {String} content
         * @param {String} name
         * @return {String|Boolean}
         */
        getWPArg = function(content, name) {
            var match = content.match(new RegExp(name+'(| ):(.*)'));
            return (match && match[2]) ? match[2].trim():false;
        },

        /**
         * @param {String} version
         * @return {Boolean}
         */
        isValidWPVersion = function(version) {
            return version && (semver.valid(version) || semver.valid(version+'.0'));
        },

        /**
         * Supported manifest types
         */
        MANIFEST = {
            JQUERY : '.jquery.json',
            COMPOSER : 'composer.json',
            WORDPRESS : 'readme.txt',
            NPM : 'package.json',
            ANDROID : 'AndroidManifest.xml'
        },

        /**
         * @param {String} manifest
         * @returns {Boolean}
         */
        isJSONManifest = function(manifest) {
            return [MANIFEST.WORDPRESS, MANIFEST.ANDROID].indexOf(manifest) === -1;
        },

        /**
         * @param {String} file
         * @param {String} type
         * @return {String|Object}
         */
        loadFile = function(file, type) {
            var content = fs.readFileSync(file);
            if( isJSONManifest(type) ) {
                try {
                    return JSON.parse(content);
                } catch(e) {
                    throw new Error('Unable to parse JSON');
                }
            }
            return content.toString();
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
                        if( !semver.validRange(version) && version != 'dev-master' )
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
         * @return {Array} Returns an array with validation faults
         */
        validate : function(arg, type) {
            var isFile = false;
            try {
                isFile = fs.statSync(arg).isFile();
            } catch(e){}

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