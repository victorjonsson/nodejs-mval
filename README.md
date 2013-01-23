nodejs-mval
===========

Command line tool used to validate manifests of various kind (jQuery, composer, npm, wordpress)


## Usage

1. Install node and npm if you haven't already.
2. Run `$ npm install -g mval` in your console
3. Now you can validate manifests anywhere. 


#### Command line 

The cli will automatically determine which type of manifest your'e trying to validate.

```
$ mval /var/www/project/composer.json
```

#### Use mval programatically

```js

var mval = require('mval'),
    MANIFEST = mval.MANIFEST;


// Validate the file package.json  
if( !mval.validate('package.json', MANIFEST.NPM) ) {
  // ....
}


// You can of course also validate an ordinary objects
var obj = {...};
if( mval.validate(obj, MANIFEST.COMPOSER) ) {
  // ...
}

```
