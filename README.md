nodejs-mval
===========

Command line tool used to validate manifests of various kind (jQuery, Android, composer, npm, wordpress)


## Usage

1. Install node and npm if you haven't already.
2. Run `$ npm install -g mval` in your console
3. Now you can validate manifests anywhere. 


#### Command line 

The command line tool will automatically determine which type of manifest you're trying to validate.

```
$ mval /var/www/project/composer.json
```

#### Use mval programatically

```js
var mval = require('mval'),
    MANIFEST = mval.MANIFEST;

// Validate android manifest file
var faults = mval.validate('AndroidManifest.xml', MANIFEST.ANDROID);
if( faults.length > 0 ) {
    throw new Error('Validation of AndroidManifest.xml failed: \n'+faults.join('\n'));
}

// You can of course also validate ordinary objects
var obj = {...};
var faults = mval.validate(obj, MANIFEST.COMPOSER);
if( faults.length > 0 ) {
    throw new Error('Validation of composer manifest failed: \n'+faults.join('\n'));
}
```

### Changelog

**1.1.0**

- Fixed bug in wordpress validation
- Fixed bug regarding validation of version numbers in composer manifests
- Added validation of android manifests
