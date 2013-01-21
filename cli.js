#!/usr/bin/node

var program = require('commander'),
    mval = require('./mval.js'),
    MANIFEST = mval.MANIFEST,
    colors = {
        red : '\033[31m',
        green : '\033[32m',
        reset : '\033[0m'
    },
    typeInputToManifest = function(t) {
        if(t) {
            for( var manifestName in MANIFEST ) {
                if( MANIFEST.hasOwnProperty(manifestName) && manifestName.toLowerCase() == t) {
                    return MANIFEST[manifestName];
                }
            }
        }
        return undefined;
    };

program
    .version(require('./package.json').version)
    .usage('[options] <file|String ...>')
    .option('-t, --type [value]', 'Add type of manifest to validate if not possible to determine from file name')
    .option('-v, --verbose [value]', 'Get a more verbose output in case of an error occurring')
    .parse(process.argv);

if( program.args.length == 0 ) {
    program.help();
}
else {
    try {

        var file = program.args[0];
        var faults = mval.validate(file, typeInputToManifest( program.type ));
        var typeLabel = program.type ? program.type.toUpperCase() : false;
        if( !typeLabel ) {
            var type = mval.getManifestTypeFromFile(file);
            Object.keys(MANIFEST).forEach(function(key) {
                if( MANIFEST[key] == type ) {
                    typeLabel = key;
                    return false;
                }
            });
        }

        if( faults.length == 0 ) {
            console.log(colors.green +file+' is a valid '+typeLabel+' manifest' + colors.reset);
        }
        else {
            console.error(colors.red +file+' is NOT a valid '+typeLabel+
                            ' manifest \n * '+ faults.join('\n * ')+ colors.reset);
        }

    } catch(e) {
        if( program.verbose ) {
            throw e;
        } else {
            console.error(colors.red +'* '+e.message + (program.verbose ? '':' (add -v for more info)') +colors.reset );
        }
    }
}