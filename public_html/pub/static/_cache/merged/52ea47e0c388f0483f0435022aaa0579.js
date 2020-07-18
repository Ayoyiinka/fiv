/** vim: et:ts=4:sw=4:sts=4
 * @license RequireJS 2.1.11 Copyright (c) 2010-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */
//Not using strict: uneven strict support in browsers, #392, and causes
//problems with requirejs.exec()/transpiler plugins that may not be strict.
/*jslint regexp: true, nomen: true, sloppy: true */
/*global window, navigator, document, importScripts, setTimeout, opera */

var requirejs, require, define;
(function (global) {
    var req, s, head, baseElement, dataMain, src,
        interactiveScript, currentlyAddingScript, mainScript, subPath,
        version = '2.1.11',
        commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg,
        cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
        jsSuffixRegExp = /\.js$/,
        currDirRegExp = /^\.\//,
        op = Object.prototype,
        ostring = op.toString,
        hasOwn = op.hasOwnProperty,
        ap = Array.prototype,
        apsp = ap.splice,
        isBrowser = !!(typeof window !== 'undefined' && typeof navigator !== 'undefined' && window.document),
        isWebWorker = !isBrowser && typeof importScripts !== 'undefined',
        //PS3 indicates loaded and complete, but need to wait for complete
        //specifically. Sequence is 'loading', 'loaded', execution,
        // then 'complete'. The UA check is unfortunate, but not sure how
        //to feature test w/o causing perf issues.
        readyRegExp = isBrowser && navigator.platform === 'PLAYSTATION 3' ?
                      /^complete$/ : /^(complete|loaded)$/,
        defContextName = '_',
        //Oh the tragedy, detecting opera. See the usage of isOpera for reason.
        isOpera = typeof opera !== 'undefined' && opera.toString() === '[object Opera]',
        contexts = {},
        cfg = {},
        globalDefQueue = [],
        useInteractive = false;

    function isFunction(it) {
        return ostring.call(it) === '[object Function]';
    }

    function isArray(it) {
        return ostring.call(it) === '[object Array]';
    }

    /**
     * Helper function for iterating over an array. If the func returns
     * a true value, it will break out of the loop.
     */
    function each(ary, func) {
        if (ary) {
            var i;
            for (i = 0; i < ary.length; i += 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    /**
     * Helper function for iterating over an array backwards. If the func
     * returns a true value, it will break out of the loop.
     */
    function eachReverse(ary, func) {
        if (ary) {
            var i;
            for (i = ary.length - 1; i > -1; i -= 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    function getOwn(obj, prop) {
        return hasProp(obj, prop) && obj[prop];
    }

    /**
     * Cycles over properties in an object and calls a function for each
     * property value. If the function returns a truthy value, then the
     * iteration is stopped.
     */
    function eachProp(obj, func) {
        var prop;
        for (prop in obj) {
            if (hasProp(obj, prop)) {
                if (func(obj[prop], prop)) {
                    break;
                }
            }
        }
    }

    /**
     * Simple function to mix in properties from source into target,
     * but only if target does not already have a property of the same name.
     */
    function mixin(target, source, force, deepStringMixin) {
        if (source) {
            eachProp(source, function (value, prop) {
                if (force || !hasProp(target, prop)) {
                    if (deepStringMixin && typeof value === 'object' && value &&
                        !isArray(value) && !isFunction(value) &&
                        !(value instanceof RegExp)) {

                        if (!target[prop]) {
                            target[prop] = {};
                        }
                        mixin(target[prop], value, force, deepStringMixin);
                    } else {
                        target[prop] = value;
                    }
                }
            });
        }
        return target;
    }

    //Similar to Function.prototype.bind, but the 'this' object is specified
    //first, since it is easier to read/figure out what 'this' will be.
    function bind(obj, fn) {
        return function () {
            return fn.apply(obj, arguments);
        };
    }

    function scripts() {
        return document.getElementsByTagName('script');
    }

    function defaultOnError(err) {
        throw err;
    }

    //Allow getting a global that is expressed in
    //dot notation, like 'a.b.c'.
    function getGlobal(value) {
        if (!value) {
            return value;
        }
        var g = global;
        each(value.split('.'), function (part) {
            g = g[part];
        });
        return g;
    }

    /**
     * Constructs an error with a pointer to an URL with more information.
     * @param {String} id the error ID that maps to an ID on a web page.
     * @param {String} message human readable error.
     * @param {Error} [err] the original error, if there is one.
     *
     * @returns {Error}
     */
    function makeError(id, msg, err, requireModules) {
        var e = new Error(msg + '\nhttp://requirejs.org/docs/errors.html#' + id);
        e.requireType = id;
        e.requireModules = requireModules;
        if (err) {
            e.originalError = err;
        }
        return e;
    }

    if (typeof define !== 'undefined') {
        //If a define is already in play via another AMD loader,
        //do not overwrite.
        return;
    }

    if (typeof requirejs !== 'undefined') {
        if (isFunction(requirejs)) {
            //Do not overwrite and existing requirejs instance.
            return;
        }
        cfg = requirejs;
        requirejs = undefined;
    }

    //Allow for a require config object
    if (typeof require !== 'undefined' && !isFunction(require)) {
        //assume it is a config object.
        cfg = require;
        require = undefined;
    }

    function newContext(contextName) {
        var inCheckLoaded, Module, context, handlers,
            checkLoadedTimeoutId,
            config = {
                //Defaults. Do not set a default for map
                //config to speed up normalize(), which
                //will run faster if there is no default.
                waitSeconds: 7,
                baseUrl: './',
                paths: {},
                bundles: {},
                pkgs: {},
                shim: {},
                config: {}
            },
            registry = {},
            //registry of just enabled modules, to speed
            //cycle breaking code when lots of modules
            //are registered, but not activated.
            enabledRegistry = {},
            undefEvents = {},
            defQueue = [],
            defined = {},
            urlFetched = {},
            bundlesMap = {},
            requireCounter = 1,
            unnormalizedCounter = 1;

        /**
         * Trims the . and .. from an array of path segments.
         * It will keep a leading path segment if a .. will become
         * the first path segment, to help with module name lookups,
         * which act like paths, but can be remapped. But the end result,
         * all paths that use this function should look normalized.
         * NOTE: this method MODIFIES the input array.
         * @param {Array} ary the array of path segments.
         */
        function trimDots(ary) {
            var i, part, length = ary.length;
            for (i = 0; i < length; i++) {
                part = ary[i];
                if (part === '.') {
                    ary.splice(i, 1);
                    i -= 1;
                } else if (part === '..') {
                    if (i === 1 && (ary[2] === '..' || ary[0] === '..')) {
                        //End of the line. Keep at least one non-dot
                        //path segment at the front so it can be mapped
                        //correctly to disk. Otherwise, there is likely
                        //no path mapping for a path starting with '..'.
                        //This can still fail, but catches the most reasonable
                        //uses of ..
                        break;
                    } else if (i > 0) {
                        ary.splice(i - 1, 2);
                        i -= 2;
                    }
                }
            }
        }

        /**
         * Given a relative module name, like ./something, normalize it to
         * a real name that can be mapped to a path.
         * @param {String} name the relative name
         * @param {String} baseName a real name that the name arg is relative
         * to.
         * @param {Boolean} applyMap apply the map config to the value. Should
         * only be done if this normalization is for a dependency ID.
         * @returns {String} normalized name
         */
        function normalize(name, baseName, applyMap) {
            var pkgMain, mapValue, nameParts, i, j, nameSegment, lastIndex,
                foundMap, foundI, foundStarMap, starI,
                baseParts = baseName && baseName.split('/'),
                normalizedBaseParts = baseParts,
                map = config.map,
                starMap = map && map['*'];

            //Adjust any relative paths.
            if (name && name.charAt(0) === '.') {
                //If have a base name, try to normalize against it,
                //otherwise, assume it is a top-level require that will
                //be relative to baseUrl in the end.
                if (baseName) {
                    //Convert baseName to array, and lop off the last part,
                    //so that . matches that 'directory' and not name of the baseName's
                    //module. For instance, baseName of 'one/two/three', maps to
                    //'one/two/three.js', but we want the directory, 'one/two' for
                    //this normalization.
                    normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                    name = name.split('/');
                    lastIndex = name.length - 1;

                    // If wanting node ID compatibility, strip .js from end
                    // of IDs. Have to do this here, and not in nameToUrl
                    // because node allows either .js or non .js to map
                    // to same file.
                    if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                        name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                    }

                    name = normalizedBaseParts.concat(name);
                    trimDots(name);
                    name = name.join('/');
                } else if (name.indexOf('./') === 0) {
                    // No baseName, so this is ID is resolved relative
                    // to baseUrl, pull off the leading dot.
                    name = name.substring(2);
                }
            }

            //Apply map config if available.
            if (applyMap && map && (baseParts || starMap)) {
                nameParts = name.split('/');

                outerLoop: for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join('/');

                    if (baseParts) {
                        //Find the longest baseName segment match in the config.
                        //So, do joins on the biggest to smallest lengths of baseParts.
                        for (j = baseParts.length; j > 0; j -= 1) {
                            mapValue = getOwn(map, baseParts.slice(0, j).join('/'));

                            //baseName segment has config, find if it has one for
                            //this name.
                            if (mapValue) {
                                mapValue = getOwn(mapValue, nameSegment);
                                if (mapValue) {
                                    //Match, update name to the new value.
                                    foundMap = mapValue;
                                    foundI = i;
                                    break outerLoop;
                                }
                            }
                        }
                    }

                    //Check for a star map match, but just hold on to it,
                    //if there is a shorter segment match later in a matching
                    //config, then favor over this star map.
                    if (!foundStarMap && starMap && getOwn(starMap, nameSegment)) {
                        foundStarMap = getOwn(starMap, nameSegment);
                        starI = i;
                    }
                }

                if (!foundMap && foundStarMap) {
                    foundMap = foundStarMap;
                    foundI = starI;
                }

                if (foundMap) {
                    nameParts.splice(0, foundI, foundMap);
                    name = nameParts.join('/');
                }
            }

            // If the name points to a package's name, use
            // the package main instead.
            pkgMain = getOwn(config.pkgs, name);

            return pkgMain ? pkgMain : name;
        }

        function removeScript(name) {
            if (isBrowser) {
                each(scripts(), function (scriptNode) {
                    if (scriptNode.getAttribute('data-requiremodule') === name &&
                            scriptNode.getAttribute('data-requirecontext') === context.contextName) {
                        scriptNode.parentNode.removeChild(scriptNode);
                        return true;
                    }
                });
            }
        }

        function hasPathFallback(id) {
            var pathConfig = getOwn(config.paths, id);
            if (pathConfig && isArray(pathConfig) && pathConfig.length > 1) {
                //Pop off the first array value, since it failed, and
                //retry
                pathConfig.shift();
                context.require.undef(id);
                context.require([id]);
                return true;
            }
        }

        //Turns a plugin!resource to [plugin, resource]
        //with the plugin being undefined if the name
        //did not have a plugin prefix.
        function splitPrefix(name) {
            var prefix,
                index = name ? name.indexOf('!') : -1;
            if (index > -1) {
                prefix = name.substring(0, index);
                name = name.substring(index + 1, name.length);
            }
            return [prefix, name];
        }

        /**
         * Creates a module mapping that includes plugin prefix, module
         * name, and path. If parentModuleMap is provided it will
         * also normalize the name via require.normalize()
         *
         * @param {String} name the module name
         * @param {String} [parentModuleMap] parent module map
         * for the module name, used to resolve relative names.
         * @param {Boolean} isNormalized: is the ID already normalized.
         * This is true if this call is done for a define() module ID.
         * @param {Boolean} applyMap: apply the map config to the ID.
         * Should only be true if this map is for a dependency.
         *
         * @returns {Object}
         */
        function makeModuleMap(name, parentModuleMap, isNormalized, applyMap) {
            var url, pluginModule, suffix, nameParts,
                prefix = null,
                parentName = parentModuleMap ? parentModuleMap.name : null,
                originalName = name,
                isDefine = true,
                normalizedName = '';

            //If no name, then it means it is a require call, generate an
            //internal name.
            if (!name) {
                isDefine = false;
                name = '_@r' + (requireCounter += 1);
            }

            nameParts = splitPrefix(name);
            prefix = nameParts[0];
            name = nameParts[1];

            if (prefix) {
                prefix = normalize(prefix, parentName, applyMap);
                pluginModule = getOwn(defined, prefix);
            }

            //Account for relative paths if there is a base name.
            if (name) {
                if (prefix) {
                    if (pluginModule && pluginModule.normalize) {
                        //Plugin is loaded, use its normalize method.
                        normalizedName = pluginModule.normalize(name, function (name) {
                            return normalize(name, parentName, applyMap);
                        });
                    } else {
                        normalizedName = normalize(name, parentName, applyMap);
                    }
                } else {
                    //A regular module.
                    normalizedName = normalize(name, parentName, applyMap);

                    //Normalized name may be a plugin ID due to map config
                    //application in normalize. The map config values must
                    //already be normalized, so do not need to redo that part.
                    nameParts = splitPrefix(normalizedName);
                    prefix = nameParts[0];
                    normalizedName = nameParts[1];
                    isNormalized = true;

                    url = context.nameToUrl(normalizedName);
                }
            }

            //If the id is a plugin id that cannot be determined if it needs
            //normalization, stamp it with a unique ID so two matching relative
            //ids that may conflict can be separate.
            suffix = prefix && !pluginModule && !isNormalized ?
                     '_unnormalized' + (unnormalizedCounter += 1) :
                     '';

            return {
                prefix: prefix,
                name: normalizedName,
                parentMap: parentModuleMap,
                unnormalized: !!suffix,
                url: url,
                originalName: originalName,
                isDefine: isDefine,
                id: (prefix ?
                        prefix + '!' + normalizedName :
                        normalizedName) + suffix
            };
        }

        function getModule(depMap) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (!mod) {
                mod = registry[id] = new context.Module(depMap);
            }

            return mod;
        }

        function on(depMap, name, fn) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (hasProp(defined, id) &&
                    (!mod || mod.defineEmitComplete)) {
                if (name === 'defined') {
                    fn(defined[id]);
                }
            } else {
                mod = getModule(depMap);
                if (mod.error && name === 'error') {
                    fn(mod.error);
                } else {
                    mod.on(name, fn);
                }
            }
        }

        function onError(err, errback) {
            var ids = err.requireModules,
                notified = false;

            if (errback) {
                errback(err);
            } else {
                each(ids, function (id) {
                    var mod = getOwn(registry, id);
                    if (mod) {
                        //Set error on module, so it skips timeout checks.
                        mod.error = err;
                        if (mod.events.error) {
                            notified = true;
                            mod.emit('error', err);
                        }
                    }
                });

                if (!notified) {
                    req.onError(err);
                }
            }
        }

        /**
         * Internal method to transfer globalQueue items to this context's
         * defQueue.
         */
        function takeGlobalQueue() {
            //Push all the globalDefQueue items into the context's defQueue
            if (globalDefQueue.length) {
                //Array splice in the values since the context code has a
                //local var ref to defQueue, so cannot just reassign the one
                //on context.
                apsp.apply(defQueue,
                           [defQueue.length, 0].concat(globalDefQueue));
                globalDefQueue = [];
            }
        }

        handlers = {
            'require': function (mod) {
                if (mod.require) {
                    return mod.require;
                } else {
                    return (mod.require = context.makeRequire(mod.map));
                }
            },
            'exports': function (mod) {
                mod.usingExports = true;
                if (mod.map.isDefine) {
                    if (mod.exports) {
                        return (defined[mod.map.id] = mod.exports);
                    } else {
                        return (mod.exports = defined[mod.map.id] = {});
                    }
                }
            },
            'module': function (mod) {
                if (mod.module) {
                    return mod.module;
                } else {
                    return (mod.module = {
                        id: mod.map.id,
                        uri: mod.map.url,
                        config: function () {
                            return  getOwn(config.config, mod.map.id) || {};
                        },
                        exports: mod.exports || (mod.exports = {})
                    });
                }
            }
        };

        function cleanRegistry(id) {
            //Clean up machinery used for waiting modules.
            delete registry[id];
            delete enabledRegistry[id];
        }

        function breakCycle(mod, traced, processed) {
            var id = mod.map.id;

            if (mod.error) {
                mod.emit('error', mod.error);
            } else {
                traced[id] = true;
                each(mod.depMaps, function (depMap, i) {
                    var depId = depMap.id,
                        dep = getOwn(registry, depId);

                    //Only force things that have not completed
                    //being defined, so still in the registry,
                    //and only if it has not been matched up
                    //in the module already.
                    if (dep && !mod.depMatched[i] && !processed[depId]) {
                        if (getOwn(traced, depId)) {
                            mod.defineDep(i, defined[depId]);
                            mod.check(); //pass false?
                        } else {
                            breakCycle(dep, traced, processed);
                        }
                    }
                });
                processed[id] = true;
            }
        }

        function checkLoaded() {
            var err, usingPathFallback,
                waitInterval = config.waitSeconds * 1000,
                //It is possible to disable the wait interval by using waitSeconds of 0.
                expired = waitInterval && (context.startTime + waitInterval) < new Date().getTime(),
                noLoads = [],
                reqCalls = [],
                stillLoading = false,
                needCycleCheck = true;

            //Do not bother if this call was a result of a cycle break.
            if (inCheckLoaded) {
                return;
            }

            inCheckLoaded = true;

            //Figure out the state of all the modules.
            eachProp(enabledRegistry, function (mod) {
                var map = mod.map,
                    modId = map.id;

                //Skip things that are not enabled or in error state.
                if (!mod.enabled) {
                    return;
                }

                if (!map.isDefine) {
                    reqCalls.push(mod);
                }

                if (!mod.error) {
                    //If the module should be executed, and it has not
                    //been inited and time is up, remember it.
                    if (!mod.inited && expired) {
                        if (hasPathFallback(modId)) {
                            usingPathFallback = true;
                            stillLoading = true;
                        } else {
                            noLoads.push(modId);
                            removeScript(modId);
                        }
                    } else if (!mod.inited && mod.fetched && map.isDefine) {
                        stillLoading = true;
                        if (!map.prefix) {
                            //No reason to keep looking for unfinished
                            //loading. If the only stillLoading is a
                            //plugin resource though, keep going,
                            //because it may be that a plugin resource
                            //is waiting on a non-plugin cycle.
                            return (needCycleCheck = false);
                        }
                    }
                }
            });

            if (expired && noLoads.length) {
                //If wait time expired, throw error of unloaded modules.
                err = makeError('timeout', 'Load timeout for modules: ' + noLoads, null, noLoads);
                err.contextName = context.contextName;
                return onError(err);
            }

            //Not expired, check for a cycle.
            if (needCycleCheck) {
                each(reqCalls, function (mod) {
                    breakCycle(mod, {}, {});
                });
            }

            //If still waiting on loads, and the waiting load is something
            //other than a plugin resource, or there are still outstanding
            //scripts, then just try back later.
            if ((!expired || usingPathFallback) && stillLoading) {
                //Something is still waiting to load. Wait for it, but only
                //if a timeout is not already in effect.
                if ((isBrowser || isWebWorker) && !checkLoadedTimeoutId) {
                    checkLoadedTimeoutId = setTimeout(function () {
                        checkLoadedTimeoutId = 0;
                        checkLoaded();
                    }, 50);
                }
            }

            inCheckLoaded = false;
        }

        Module = function (map) {
            this.events = getOwn(undefEvents, map.id) || {};
            this.map = map;
            this.shim = getOwn(config.shim, map.id);
            this.depExports = [];
            this.depMaps = [];
            this.depMatched = [];
            this.pluginMaps = {};
            this.depCount = 0;

            /* this.exports this.factory
               this.depMaps = [],
               this.enabled, this.fetched
            */
        };

        Module.prototype = {
            init: function (depMaps, factory, errback, options) {
                options = options || {};

                //Do not do more inits if already done. Can happen if there
                //are multiple define calls for the same module. That is not
                //a normal, common case, but it is also not unexpected.
                if (this.inited) {
                    return;
                }

                this.factory = factory;

                if (errback) {
                    //Register for errors on this module.
                    this.on('error', errback);
                } else if (this.events.error) {
                    //If no errback already, but there are error listeners
                    //on this module, set up an errback to pass to the deps.
                    errback = bind(this, function (err) {
                        this.emit('error', err);
                    });
                }

                //Do a copy of the dependency array, so that
                //source inputs are not modified. For example
                //"shim" deps are passed in here directly, and
                //doing a direct modification of the depMaps array
                //would affect that config.
                this.depMaps = depMaps && depMaps.slice(0);

                this.errback = errback;

                //Indicate this module has be initialized
                this.inited = true;

                this.ignore = options.ignore;

                //Could have option to init this module in enabled mode,
                //or could have been previously marked as enabled. However,
                //the dependencies are not known until init is called. So
                //if enabled previously, now trigger dependencies as enabled.
                if (options.enabled || this.enabled) {
                    //Enable this module and dependencies.
                    //Will call this.check()
                    this.enable();
                } else {
                    this.check();
                }
            },

            defineDep: function (i, depExports) {
                //Because of cycles, defined callback for a given
                //export can be called more than once.
                if (!this.depMatched[i]) {
                    this.depMatched[i] = true;
                    this.depCount -= 1;
                    this.depExports[i] = depExports;
                }
            },

            fetch: function () {
                if (this.fetched) {
                    return;
                }
                this.fetched = true;

                context.startTime = (new Date()).getTime();

                var map = this.map;

                //If the manager is for a plugin managed resource,
                //ask the plugin to load it now.
                if (this.shim) {
                    context.makeRequire(this.map, {
                        enableBuildCallback: true
                    })(this.shim.deps || [], bind(this, function () {
                        return map.prefix ? this.callPlugin() : this.load();
                    }));
                } else {
                    //Regular dependency.
                    return map.prefix ? this.callPlugin() : this.load();
                }
            },

            load: function () {
                var url = this.map.url;

                //Regular dependency.
                if (!urlFetched[url]) {
                    urlFetched[url] = true;
                    context.load(this.map.id, url);
                }
            },

            /**
             * Checks if the module is ready to define itself, and if so,
             * define it.
             */
            check: function () {
                if (!this.enabled || this.enabling) {
                    return;
                }

                var err, cjsModule,
                    id = this.map.id,
                    depExports = this.depExports,
                    exports = this.exports,
                    factory = this.factory;

                if (!this.inited) {
                    this.fetch();
                } else if (this.error) {
                    this.emit('error', this.error);
                } else if (!this.defining) {
                    //The factory could trigger another require call
                    //that would result in checking this module to
                    //define itself again. If already in the process
                    //of doing that, skip this work.
                    this.defining = true;

                    if (this.depCount < 1 && !this.defined) {
                        if (isFunction(factory)) {
                            //If there is an error listener, favor passing
                            //to that instead of throwing an error. However,
                            //only do it for define()'d  modules. require
                            //errbacks should not be called for failures in
                            //their callbacks (#699). However if a global
                            //onError is set, use that.
                            if ((this.events.error && this.map.isDefine) ||
                                req.onError !== defaultOnError) {
                                try {
                                    exports = context.execCb(id, factory, depExports, exports);
                                } catch (e) {
                                    err = e;
                                }
                            } else {
                                exports = context.execCb(id, factory, depExports, exports);
                            }

                            // Favor return value over exports. If node/cjs in play,
                            // then will not have a return value anyway. Favor
                            // module.exports assignment over exports object.
                            if (this.map.isDefine && exports === undefined) {
                                cjsModule = this.module;
                                if (cjsModule) {
                                    exports = cjsModule.exports;
                                } else if (this.usingExports) {
                                    //exports already set the defined value.
                                    exports = this.exports;
                                }
                            }

                            if (err) {
                                err.requireMap = this.map;
                                err.requireModules = this.map.isDefine ? [this.map.id] : null;
                                err.requireType = this.map.isDefine ? 'define' : 'require';
                                return onError((this.error = err));
                            }

                        } else {
                            //Just a literal value
                            exports = factory;
                        }

                        this.exports = exports;

                        if (this.map.isDefine && !this.ignore) {
                            defined[id] = exports;

                            if (req.onResourceLoad) {
                                req.onResourceLoad(context, this.map, this.depMaps);
                            }
                        }

                        //Clean up
                        cleanRegistry(id);

                        this.defined = true;
                    }

                    //Finished the define stage. Allow calling check again
                    //to allow define notifications below in the case of a
                    //cycle.
                    this.defining = false;

                    if (this.defined && !this.defineEmitted) {
                        this.defineEmitted = true;
                        this.emit('defined', this.exports);
                        this.defineEmitComplete = true;
                    }

                }
            },

            callPlugin: function () {
                var map = this.map,
                    id = map.id,
                    //Map already normalized the prefix.
                    pluginMap = makeModuleMap(map.prefix);

                //Mark this as a dependency for this plugin, so it
                //can be traced for cycles.
                this.depMaps.push(pluginMap);

                on(pluginMap, 'defined', bind(this, function (plugin) {
                    var load, normalizedMap, normalizedMod,
                        bundleId = getOwn(bundlesMap, this.map.id),
                        name = this.map.name,
                        parentName = this.map.parentMap ? this.map.parentMap.name : null,
                        localRequire = context.makeRequire(map.parentMap, {
                            enableBuildCallback: true
                        });

                    //If current map is not normalized, wait for that
                    //normalized name to load instead of continuing.
                    if (this.map.unnormalized) {
                        //Normalize the ID if the plugin allows it.
                        if (plugin.normalize) {
                            name = plugin.normalize(name, function (name) {
                                return normalize(name, parentName, true);
                            }) || '';
                        }

                        //prefix and name should already be normalized, no need
                        //for applying map config again either.
                        normalizedMap = makeModuleMap(map.prefix + '!' + name,
                                                      this.map.parentMap);
                        on(normalizedMap,
                            'defined', bind(this, function (value) {
                                this.init([], function () { return value; }, null, {
                                    enabled: true,
                                    ignore: true
                                });
                            }));

                        normalizedMod = getOwn(registry, normalizedMap.id);
                        if (normalizedMod) {
                            //Mark this as a dependency for this plugin, so it
                            //can be traced for cycles.
                            this.depMaps.push(normalizedMap);

                            if (this.events.error) {
                                normalizedMod.on('error', bind(this, function (err) {
                                    this.emit('error', err);
                                }));
                            }
                            normalizedMod.enable();
                        }

                        return;
                    }

                    //If a paths config, then just load that file instead to
                    //resolve the plugin, as it is built into that paths layer.
                    if (bundleId) {
                        this.map.url = context.nameToUrl(bundleId);
                        this.load();
                        return;
                    }

                    load = bind(this, function (value) {
                        this.init([], function () { return value; }, null, {
                            enabled: true
                        });
                    });

                    load.error = bind(this, function (err) {
                        this.inited = true;
                        this.error = err;
                        err.requireModules = [id];

                        //Remove temp unnormalized modules for this module,
                        //since they will never be resolved otherwise now.
                        eachProp(registry, function (mod) {
                            if (mod.map.id.indexOf(id + '_unnormalized') === 0) {
                                cleanRegistry(mod.map.id);
                            }
                        });

                        onError(err);
                    });

                    //Allow plugins to load other code without having to know the
                    //context or how to 'complete' the load.
                    load.fromText = bind(this, function (text, textAlt) {
                        /*jslint evil: true */
                        var moduleName = map.name,
                            moduleMap = makeModuleMap(moduleName),
                            hasInteractive = useInteractive;

                        //As of 2.1.0, support just passing the text, to reinforce
                        //fromText only being called once per resource. Still
                        //support old style of passing moduleName but discard
                        //that moduleName in favor of the internal ref.
                        if (textAlt) {
                            text = textAlt;
                        }

                        //Turn off interactive script matching for IE for any define
                        //calls in the text, then turn it back on at the end.
                        if (hasInteractive) {
                            useInteractive = false;
                        }

                        //Prime the system by creating a module instance for
                        //it.
                        getModule(moduleMap);

                        //Transfer any config to this other module.
                        if (hasProp(config.config, id)) {
                            config.config[moduleName] = config.config[id];
                        }

                        try {
                            req.exec(text);
                        } catch (e) {
                            return onError(makeError('fromtexteval',
                                             'fromText eval for ' + id +
                                            ' failed: ' + e,
                                             e,
                                             [id]));
                        }

                        if (hasInteractive) {
                            useInteractive = true;
                        }

                        //Mark this as a dependency for the plugin
                        //resource
                        this.depMaps.push(moduleMap);

                        //Support anonymous modules.
                        context.completeLoad(moduleName);

                        //Bind the value of that module to the value for this
                        //resource ID.
                        localRequire([moduleName], load);
                    });

                    //Use parentName here since the plugin's name is not reliable,
                    //could be some weird string with no path that actually wants to
                    //reference the parentName's path.
                    plugin.load(map.name, localRequire, load, config);
                }));

                context.enable(pluginMap, this);
                this.pluginMaps[pluginMap.id] = pluginMap;
            },

            enable: function () {
                enabledRegistry[this.map.id] = this;
                this.enabled = true;

                //Set flag mentioning that the module is enabling,
                //so that immediate calls to the defined callbacks
                //for dependencies do not trigger inadvertent load
                //with the depCount still being zero.
                this.enabling = true;

                //Enable each dependency
                each(this.depMaps, bind(this, function (depMap, i) {
                    var id, mod, handler;

                    if (typeof depMap === 'string') {
                        //Dependency needs to be converted to a depMap
                        //and wired up to this module.
                        depMap = makeModuleMap(depMap,
                                               (this.map.isDefine ? this.map : this.map.parentMap),
                                               false,
                                               !this.skipMap);
                        this.depMaps[i] = depMap;

                        handler = getOwn(handlers, depMap.id);

                        if (handler) {
                            this.depExports[i] = handler(this);
                            return;
                        }

                        this.depCount += 1;

                        on(depMap, 'defined', bind(this, function (depExports) {
                            this.defineDep(i, depExports);
                            this.check();
                        }));

                        if (this.errback) {
                            on(depMap, 'error', bind(this, this.errback));
                        }
                    }

                    id = depMap.id;
                    mod = registry[id];

                    //Skip special modules like 'require', 'exports', 'module'
                    //Also, don't call enable if it is already enabled,
                    //important in circular dependency cases.
                    if (!hasProp(handlers, id) && mod && !mod.enabled) {
                        context.enable(depMap, this);
                    }
                }));

                //Enable each plugin that is used in
                //a dependency
                eachProp(this.pluginMaps, bind(this, function (pluginMap) {
                    var mod = getOwn(registry, pluginMap.id);
                    if (mod && !mod.enabled) {
                        context.enable(pluginMap, this);
                    }
                }));

                this.enabling = false;

                this.check();
            },

            on: function (name, cb) {
                var cbs = this.events[name];
                if (!cbs) {
                    cbs = this.events[name] = [];
                }
                cbs.push(cb);
            },

            emit: function (name, evt) {
                each(this.events[name], function (cb) {
                    cb(evt);
                });
                if (name === 'error') {
                    //Now that the error handler was triggered, remove
                    //the listeners, since this broken Module instance
                    //can stay around for a while in the registry.
                    delete this.events[name];
                }
            }
        };

        function callGetModule(args) {
            //Skip modules already defined.
            if (!hasProp(defined, args[0])) {
                getModule(makeModuleMap(args[0], null, true)).init(args[1], args[2]);
            }
        }

        function removeListener(node, func, name, ieName) {
            //Favor detachEvent because of IE9
            //issue, see attachEvent/addEventListener comment elsewhere
            //in this file.
            if (node.detachEvent && !isOpera) {
                //Probably IE. If not it will throw an error, which will be
                //useful to know.
                if (ieName) {
                    node.detachEvent(ieName, func);
                }
            } else {
                node.removeEventListener(name, func, false);
            }
        }

        /**
         * Given an event from a script node, get the requirejs info from it,
         * and then removes the event listeners on the node.
         * @param {Event} evt
         * @returns {Object}
         */
        function getScriptData(evt) {
            //Using currentTarget instead of target for Firefox 2.0's sake. Not
            //all old browsers will be supported, but this one was easy enough
            //to support and still makes sense.
            var node = evt.currentTarget || evt.srcElement;

            //Remove the listeners once here.
            removeListener(node, context.onScriptLoad, 'load', 'onreadystatechange');
            removeListener(node, context.onScriptError, 'error');

            return {
                node: node,
                id: node && node.getAttribute('data-requiremodule')
            };
        }

        function intakeDefines() {
            var args;

            //Any defined modules in the global queue, intake them now.
            takeGlobalQueue();

            //Make sure any remaining defQueue items get properly processed.
            while (defQueue.length) {
                args = defQueue.shift();
                if (args[0] === null) {
                    return onError(makeError('mismatch', 'Mismatched anonymous define() module: ' + args[args.length - 1]));
                } else {
                    //args are id, deps, factory. Should be normalized by the
                    //define() function.
                    callGetModule(args);
                }
            }
        }

        context = {
            config: config,
            contextName: contextName,
            registry: registry,
            defined: defined,
            urlFetched: urlFetched,
            defQueue: defQueue,
            Module: Module,
            makeModuleMap: makeModuleMap,
            nextTick: req.nextTick,
            onError: onError,

            /**
             * Set a configuration for the context.
             * @param {Object} cfg config object to integrate.
             */
            configure: function (cfg) {
                //Make sure the baseUrl ends in a slash.
                if (cfg.baseUrl) {
                    if (cfg.baseUrl.charAt(cfg.baseUrl.length - 1) !== '/') {
                        cfg.baseUrl += '/';
                    }
                }

                //Save off the paths since they require special processing,
                //they are additive.
                var shim = config.shim,
                    objs = {
                        paths: true,
                        bundles: true,
                        config: true,
                        map: true
                    };

                eachProp(cfg, function (value, prop) {
                    if (objs[prop]) {
                        if (!config[prop]) {
                            config[prop] = {};
                        }
                        mixin(config[prop], value, true, true);
                    } else {
                        config[prop] = value;
                    }
                });

                //Reverse map the bundles
                if (cfg.bundles) {
                    eachProp(cfg.bundles, function (value, prop) {
                        each(value, function (v) {
                            if (v !== prop) {
                                bundlesMap[v] = prop;
                            }
                        });
                    });
                }

                //Merge shim
                if (cfg.shim) {
                    eachProp(cfg.shim, function (value, id) {
                        //Normalize the structure
                        if (isArray(value)) {
                            value = {
                                deps: value
                            };
                        }
                        if ((value.exports || value.init) && !value.exportsFn) {
                            value.exportsFn = context.makeShimExports(value);
                        }
                        shim[id] = value;
                    });
                    config.shim = shim;
                }

                //Adjust packages if necessary.
                if (cfg.packages) {
                    each(cfg.packages, function (pkgObj) {
                        var location, name;

                        pkgObj = typeof pkgObj === 'string' ? { name: pkgObj } : pkgObj;

                        name = pkgObj.name;
                        location = pkgObj.location;
                        if (location) {
                            config.paths[name] = pkgObj.location;
                        }

                        //Save pointer to main module ID for pkg name.
                        //Remove leading dot in main, so main paths are normalized,
                        //and remove any trailing .js, since different package
                        //envs have different conventions: some use a module name,
                        //some use a file name.
                        config.pkgs[name] = pkgObj.name + '/' + (pkgObj.main || 'main')
                                     .replace(currDirRegExp, '')
                                     .replace(jsSuffixRegExp, '');
                    });
                }

                //If there are any "waiting to execute" modules in the registry,
                //update the maps for them, since their info, like URLs to load,
                //may have changed.
                eachProp(registry, function (mod, id) {
                    //If module already has init called, since it is too
                    //late to modify them, and ignore unnormalized ones
                    //since they are transient.
                    if (!mod.inited && !mod.map.unnormalized) {
                        mod.map = makeModuleMap(id);
                    }
                });

                //If a deps array or a config callback is specified, then call
                //require with those args. This is useful when require is defined as a
                //config object before require.js is loaded.
                if (cfg.deps || cfg.callback) {
                    context.require(cfg.deps || [], cfg.callback);
                }
            },

            makeShimExports: function (value) {
                function fn() {
                    var ret;
                    if (value.init) {
                        ret = value.init.apply(global, arguments);
                    }
                    return ret || (value.exports && getGlobal(value.exports));
                }
                return fn;
            },

            makeRequire: function (relMap, options) {
                options = options || {};

                function localRequire(deps, callback, errback) {
                    var id, map, requireMod;

                    if (options.enableBuildCallback && callback && isFunction(callback)) {
                        callback.__requireJsBuild = true;
                    }

                    if (typeof deps === 'string') {
                        if (isFunction(callback)) {
                            //Invalid call
                            return onError(makeError('requireargs', 'Invalid require call'), errback);
                        }

                        //If require|exports|module are requested, get the
                        //value for them from the special handlers. Caveat:
                        //this only works while module is being defined.
                        if (relMap && hasProp(handlers, deps)) {
                            return handlers[deps](registry[relMap.id]);
                        }

                        //Synchronous access to one module. If require.get is
                        //available (as in the Node adapter), prefer that.
                        if (req.get) {
                            return req.get(context, deps, relMap, localRequire);
                        }

                        //Normalize module name, if it contains . or ..
                        map = makeModuleMap(deps, relMap, false, true);
                        id = map.id;

                        if (!hasProp(defined, id)) {
                            return onError(makeError('notloaded', 'Module name "' +
                                        id +
                                        '" has not been loaded yet for context: ' +
                                        contextName +
                                        (relMap ? '' : '. Use require([])')));
                        }
                        return defined[id];
                    }

                    //Grab defines waiting in the global queue.
                    intakeDefines();

                    //Mark all the dependencies as needing to be loaded.
                    context.nextTick(function () {
                        //Some defines could have been added since the
                        //require call, collect them.
                        intakeDefines();

                        requireMod = getModule(makeModuleMap(null, relMap));

                        //Store if map config should be applied to this require
                        //call for dependencies.
                        requireMod.skipMap = options.skipMap;

                        requireMod.init(deps, callback, errback, {
                            enabled: true
                        });

                        checkLoaded();
                    });

                    return localRequire;
                }

                mixin(localRequire, {
                    isBrowser: isBrowser,

                    /**
                     * Converts a module name + .extension into an URL path.
                     * *Requires* the use of a module name. It does not support using
                     * plain URLs like nameToUrl.
                     */
                    toUrl: function (moduleNamePlusExt) {
                        var ext,
                            index = moduleNamePlusExt.lastIndexOf('.'),
                            segment = moduleNamePlusExt.split('/')[0],
                            isRelative = segment === '.' || segment === '..';

                        //Have a file extension alias, and it is not the
                        //dots from a relative path.
                        if (index !== -1 && (!isRelative || index > 1)) {
                            ext = moduleNamePlusExt.substring(index, moduleNamePlusExt.length);
                            moduleNamePlusExt = moduleNamePlusExt.substring(0, index);
                        }

                        return context.nameToUrl(normalize(moduleNamePlusExt,
                                                relMap && relMap.id, true), ext,  true);
                    },

                    defined: function (id) {
                        return hasProp(defined, makeModuleMap(id, relMap, false, true).id);
                    },

                    specified: function (id) {
                        id = makeModuleMap(id, relMap, false, true).id;
                        return hasProp(defined, id) || hasProp(registry, id);
                    }
                });

                //Only allow undef on top level require calls
                if (!relMap) {
                    localRequire.undef = function (id) {
                        //Bind any waiting define() calls to this context,
                        //fix for #408
                        takeGlobalQueue();

                        var map = makeModuleMap(id, relMap, true),
                            mod = getOwn(registry, id);

                        removeScript(id);

                        delete defined[id];
                        delete urlFetched[map.url];
                        delete undefEvents[id];

                        //Clean queued defines too. Go backwards
                        //in array so that the splices do not
                        //mess up the iteration.
                        eachReverse(defQueue, function(args, i) {
                            if(args[0] === id) {
                                defQueue.splice(i, 1);
                            }
                        });

                        if (mod) {
                            //Hold on to listeners in case the
                            //module will be attempted to be reloaded
                            //using a different config.
                            if (mod.events.defined) {
                                undefEvents[id] = mod.events;
                            }

                            cleanRegistry(id);
                        }
                    };
                }

                return localRequire;
            },

            /**
             * Called to enable a module if it is still in the registry
             * awaiting enablement. A second arg, parent, the parent module,
             * is passed in for context, when this method is overridden by
             * the optimizer. Not shown here to keep code compact.
             */
            enable: function (depMap) {
                var mod = getOwn(registry, depMap.id);
                if (mod) {
                    getModule(depMap).enable();
                }
            },

            /**
             * Internal method used by environment adapters to complete a load event.
             * A load event could be a script load or just a load pass from a synchronous
             * load call.
             * @param {String} moduleName the name of the module to potentially complete.
             */
            completeLoad: function (moduleName) {
                var found, args, mod,
                    shim = getOwn(config.shim, moduleName) || {},
                    shExports = shim.exports;

                takeGlobalQueue();

                while (defQueue.length) {
                    args = defQueue.shift();
                    if (args[0] === null) {
                        args[0] = moduleName;
                        //If already found an anonymous module and bound it
                        //to this name, then this is some other anon module
                        //waiting for its completeLoad to fire.
                        if (found) {
                            break;
                        }
                        found = true;
                    } else if (args[0] === moduleName) {
                        //Found matching define call for this script!
                        found = true;
                    }

                    callGetModule(args);
                }

                //Do this after the cycle of callGetModule in case the result
                //of those calls/init calls changes the registry.
                mod = getOwn(registry, moduleName);

                if (!found && !hasProp(defined, moduleName) && mod && !mod.inited) {
                    if (config.enforceDefine && (!shExports || !getGlobal(shExports))) {
                        if (hasPathFallback(moduleName)) {
                            return;
                        } else {
                            return onError(makeError('nodefine',
                                             'No define call for ' + moduleName,
                                             null,
                                             [moduleName]));
                        }
                    } else {
                        //A script that does not call define(), so just simulate
                        //the call for it.
                        callGetModule([moduleName, (shim.deps || []), shim.exportsFn]);
                    }
                }

                checkLoaded();
            },

            /**
             * Converts a module name to a file path. Supports cases where
             * moduleName may actually be just an URL.
             * Note that it **does not** call normalize on the moduleName,
             * it is assumed to have already been normalized. This is an
             * internal API, not a public one. Use toUrl for the public API.
             */
            nameToUrl: function (moduleName, ext, skipExt) {
                var paths, syms, i, parentModule, url,
                    parentPath, bundleId,
                    pkgMain = getOwn(config.pkgs, moduleName);

                if (pkgMain) {
                    moduleName = pkgMain;
                }

                bundleId = getOwn(bundlesMap, moduleName);

                if (bundleId) {
                    return context.nameToUrl(bundleId, ext, skipExt);
                }

                //If a colon is in the URL, it indicates a protocol is used and it is just
                //an URL to a file, or if it starts with a slash, contains a query arg (i.e. ?)
                //or ends with .js, then assume the user meant to use an url and not a module id.
                //The slash is important for protocol-less URLs as well as full paths.
                if (req.jsExtRegExp.test(moduleName)) {
                    //Just a plain path, not module name lookup, so just return it.
                    //Add extension if it is included. This is a bit wonky, only non-.js things pass
                    //an extension, this method probably needs to be reworked.
                    url = moduleName + (ext || '');
                } else {
                    //A module that needs to be converted to a path.
                    paths = config.paths;

                    syms = moduleName.split('/');
                    //For each module name segment, see if there is a path
                    //registered for it. Start with most specific name
                    //and work up from it.
                    for (i = syms.length; i > 0; i -= 1) {
                        parentModule = syms.slice(0, i).join('/');

                        parentPath = getOwn(paths, parentModule);
                        if (parentPath) {
                            //If an array, it means there are a few choices,
                            //Choose the one that is desired
                            if (isArray(parentPath)) {
                                parentPath = parentPath[0];
                            }
                            syms.splice(0, i, parentPath);
                            break;
                        }
                    }

                    //Join the path parts together, then figure out if baseUrl is needed.
                    url = syms.join('/');
                    url += (ext || (/^data\:|\?/.test(url) || skipExt ? '' : '.js'));
                    url = (url.charAt(0) === '/' || url.match(/^[\w\+\.\-]+:/) ? '' : config.baseUrl) + url;
                }

                return config.urlArgs ? url +
                                        ((url.indexOf('?') === -1 ? '?' : '&') +
                                         config.urlArgs) : url;
            },

            //Delegates to req.load. Broken out as a separate function to
            //allow overriding in the optimizer.
            load: function (id, url) {
                req.load(context, id, url);
            },

            /**
             * Executes a module callback function. Broken out as a separate function
             * solely to allow the build system to sequence the files in the built
             * layer in the right sequence.
             *
             * @private
             */
            execCb: function (name, callback, args, exports) {
                return callback.apply(exports, args);
            },

            /**
             * callback for script loads, used to check status of loading.
             *
             * @param {Event} evt the event from the browser for the script
             * that was loaded.
             */
            onScriptLoad: function (evt) {
                //Using currentTarget instead of target for Firefox 2.0's sake. Not
                //all old browsers will be supported, but this one was easy enough
                //to support and still makes sense.
                if (evt.type === 'load' ||
                        (readyRegExp.test((evt.currentTarget || evt.srcElement).readyState))) {
                    //Reset interactive script so a script node is not held onto for
                    //to long.
                    interactiveScript = null;

                    //Pull out the name of the module and the context.
                    var data = getScriptData(evt);
                    context.completeLoad(data.id);
                }
            },

            /**
             * Callback for script errors.
             */
            onScriptError: function (evt) {
                var data = getScriptData(evt);
                if (!hasPathFallback(data.id)) {
                    return onError(makeError('scripterror', 'Script error for: ' + data.id, evt, [data.id]));
                }
            }
        };

        context.require = context.makeRequire();
        return context;
    }

    /**
     * Main entry point.
     *
     * If the only argument to require is a string, then the module that
     * is represented by that string is fetched for the appropriate context.
     *
     * If the first argument is an array, then it will be treated as an array
     * of dependency string names to fetch. An optional function callback can
     * be specified to execute when all of those dependencies are available.
     *
     * Make a local req variable to help Caja compliance (it assumes things
     * on a require that are not standardized), and to give a short
     * name for minification/local scope use.
     */
    req = requirejs = function (deps, callback, errback, optional) {

        //Find the right context, use default
        var context, config,
            contextName = defContextName;

        // Determine if have config object in the call.
        if (!isArray(deps) && typeof deps !== 'string') {
            // deps is a config object
            config = deps;
            if (isArray(callback)) {
                // Adjust args if there are dependencies
                deps = callback;
                callback = errback;
                errback = optional;
            } else {
                deps = [];
            }
        }

        if (config && config.context) {
            contextName = config.context;
        }

        context = getOwn(contexts, contextName);
        if (!context) {
            context = contexts[contextName] = req.s.newContext(contextName);
        }

        if (config) {
            context.configure(config);
        }

        return context.require(deps, callback, errback);
    };

    /**
     * Support require.config() to make it easier to cooperate with other
     * AMD loaders on globally agreed names.
     */
    req.config = function (config) {
        return req(config);
    };

    /**
     * Execute something after the current tick
     * of the event loop. Override for other envs
     * that have a better solution than setTimeout.
     * @param  {Function} fn function to execute later.
     */
    req.nextTick = typeof setTimeout !== 'undefined' ? function (fn) {
        setTimeout(fn, 4);
    } : function (fn) { fn(); };

    /**
     * Export require as a global, but only if it does not already exist.
     */
    if (!require) {
        require = req;
    }

    req.version = version;

    //Used to filter out dependencies that are already paths.
    req.jsExtRegExp = /^\/|:|\?|\.js$/;
    req.isBrowser = isBrowser;
    s = req.s = {
        contexts: contexts,
        newContext: newContext
    };

    //Create default context.
    req({});

    //Exports some context-sensitive methods on global require.
    each([
        'toUrl',
        'undef',
        'defined',
        'specified'
    ], function (prop) {
        //Reference from contexts instead of early binding to default context,
        //so that during builds, the latest instance of the default context
        //with its config gets used.
        req[prop] = function () {
            var ctx = contexts[defContextName];
            return ctx.require[prop].apply(ctx, arguments);
        };
    });

    if (isBrowser) {
        head = s.head = document.getElementsByTagName('head')[0];
        //If BASE tag is in play, using appendChild is a problem for IE6.
        //When that browser dies, this can be removed. Details in this jQuery bug:
        //http://dev.jquery.com/ticket/2709
        baseElement = document.getElementsByTagName('base')[0];
        if (baseElement) {
            head = s.head = baseElement.parentNode;
        }
    }

    /**
     * Any errors that require explicitly generates will be passed to this
     * function. Intercept/override it if you want custom error handling.
     * @param {Error} err the error object.
     */
    req.onError = defaultOnError;

    /**
     * Creates the node for the load command. Only used in browser envs.
     */
    req.createNode = function (config, moduleName, url) {
        var node = config.xhtml ?
                document.createElementNS('http://www.w3.org/1999/xhtml', 'html:script') :
                document.createElement('script');
        node.type = config.scriptType || 'text/javascript';
        node.charset = 'utf-8';
        node.async = true;
        return node;
    };

    /**
     * Does the request to load a module for the browser case.
     * Make this a separate function to allow other environments
     * to override it.
     *
     * @param {Object} context the require context to find state.
     * @param {String} moduleName the name of the module.
     * @param {Object} url the URL to the module.
     */
    req.load = function (context, moduleName, url) {
        var config = (context && context.config) || {},
            node;
        if (isBrowser) {
            //In the browser so use a script tag
            node = req.createNode(config, moduleName, url);

            node.setAttribute('data-requirecontext', context.contextName);
            node.setAttribute('data-requiremodule', moduleName);

            //Set up load listener. Test attachEvent first because IE9 has
            //a subtle issue in its addEventListener and script onload firings
            //that do not match the behavior of all other browsers with
            //addEventListener support, which fire the onload event for a
            //script right after the script execution. See:
            //https://connect.microsoft.com/IE/feedback/details/648057/script-onload-event-is-not-fired-immediately-after-script-execution
            //UNFORTUNATELY Opera implements attachEvent but does not follow the script
            //script execution mode.
            if (node.attachEvent &&
                    //Check if node.attachEvent is artificially added by custom script or
                    //natively supported by browser
                    //read https://github.com/jrburke/requirejs/issues/187
                    //if we can NOT find [native code] then it must NOT natively supported.
                    //in IE8, node.attachEvent does not have toString()
                    //Note the test for "[native code" with no closing brace, see:
                    //https://github.com/jrburke/requirejs/issues/273
                    !(node.attachEvent.toString && node.attachEvent.toString().indexOf('[native code') < 0) &&
                    !isOpera) {
                //Probably IE. IE (at least 6-8) do not fire
                //script onload right after executing the script, so
                //we cannot tie the anonymous define call to a name.
                //However, IE reports the script as being in 'interactive'
                //readyState at the time of the define call.
                useInteractive = true;

                node.attachEvent('onreadystatechange', context.onScriptLoad);
                //It would be great to add an error handler here to catch
                //404s in IE9+. However, onreadystatechange will fire before
                //the error handler, so that does not help. If addEventListener
                //is used, then IE will fire error before load, but we cannot
                //use that pathway given the connect.microsoft.com issue
                //mentioned above about not doing the 'script execute,
                //then fire the script load event listener before execute
                //next script' that other browsers do.
                //Best hope: IE10 fixes the issues,
                //and then destroys all installs of IE 6-9.
                //node.attachEvent('onerror', context.onScriptError);
            } else {
                node.addEventListener('load', context.onScriptLoad, false);
                node.addEventListener('error', context.onScriptError, false);
            }
            node.src = url;

            //For some cache cases in IE 6-8, the script executes before the end
            //of the appendChild execution, so to tie an anonymous define
            //call to the module name (which is stored on the node), hold on
            //to a reference to this node, but clear after the DOM insertion.
            currentlyAddingScript = node;
            if (baseElement) {
                head.insertBefore(node, baseElement);
            } else {
                head.appendChild(node);
            }
            currentlyAddingScript = null;

            return node;
        } else if (isWebWorker) {
            try {
                //In a web worker, use importScripts. This is not a very
                //efficient use of importScripts, importScripts will block until
                //its script is downloaded and evaluated. However, if web workers
                //are in play, the expectation that a build has been done so that
                //only one script needs to be loaded anyway. This may need to be
                //reevaluated if other use cases become common.
                importScripts(url);

                //Account for anonymous modules
                context.completeLoad(moduleName);
            } catch (e) {
                context.onError(makeError('importscripts',
                                'importScripts failed for ' +
                                    moduleName + ' at ' + url,
                                e,
                                [moduleName]));
            }
        }
    };

    function getInteractiveScript() {
        if (interactiveScript && interactiveScript.readyState === 'interactive') {
            return interactiveScript;
        }

        eachReverse(scripts(), function (script) {
            if (script.readyState === 'interactive') {
                return (interactiveScript = script);
            }
        });
        return interactiveScript;
    }

    //Look for a data-main script attribute, which could also adjust the baseUrl.
    if (isBrowser && !cfg.skipDataMain) {
        //Figure out baseUrl. Get it from the script tag with require.js in it.
        eachReverse(scripts(), function (script) {
            //Set the 'head' where we can append children by
            //using the script's parent.
            if (!head) {
                head = script.parentNode;
            }

            //Look for a data-main attribute to set main script for the page
            //to load. If it is there, the path to data main becomes the
            //baseUrl, if it is not already set.
            dataMain = script.getAttribute('data-main');
            if (dataMain) {
                //Preserve dataMain in case it is a path (i.e. contains '?')
                mainScript = dataMain;

                //Set final baseUrl if there is not already an explicit one.
                if (!cfg.baseUrl) {
                    //Pull off the directory of data-main for use as the
                    //baseUrl.
                    src = mainScript.split('/');
                    mainScript = src.pop();
                    subPath = src.length ? src.join('/')  + '/' : './';

                    cfg.baseUrl = subPath;
                }

                //Strip off any trailing .js since mainScript is now
                //like a module name.
                mainScript = mainScript.replace(jsSuffixRegExp, '');

                 //If mainScript is still a path, fall back to dataMain
                if (req.jsExtRegExp.test(mainScript)) {
                    mainScript = dataMain;
                }

                //Put the data-main script in the files to load.
                cfg.deps = cfg.deps ? cfg.deps.concat(mainScript) : [mainScript];

                return true;
            }
        });
    }

    /**
     * The function that handles definitions of modules. Differs from
     * require() in that a string for the module should be the first argument,
     * and the function to execute after dependencies are loaded should
     * return a value to define the module corresponding to the first argument's
     * name.
     */
    define = function (name, deps, callback) {
        var node, context;

        //Allow for anonymous modules
        if (typeof name !== 'string') {
            //Adjust args appropriately
            callback = deps;
            deps = name;
            name = null;
        }

        //This module may not have dependencies
        if (!isArray(deps)) {
            callback = deps;
            deps = null;
        }

        //If no name, and callback is a function, then figure out if it a
        //CommonJS thing with dependencies.
        if (!deps && isFunction(callback)) {
            deps = [];
            //Remove comments from the callback string,
            //look for require calls, and pull them into the dependencies,
            //but only if there are function args.
            if (callback.length) {
                callback
                    .toString()
                    .replace(commentRegExp, '')
                    .replace(cjsRequireRegExp, function (match, dep) {
                        deps.push(dep);
                    });

                //May be a CommonJS thing even without require calls, but still
                //could use exports, and module. Avoid doing exports and module
                //work though if it just needs require.
                //REQUIRES the function to expect the CommonJS variables in the
                //order listed below.
                deps = (callback.length === 1 ? ['require'] : ['require', 'exports', 'module']).concat(deps);
            }
        }

        //If in IE 6-8 and hit an anonymous define() call, do the interactive
        //work.
        if (useInteractive) {
            node = currentlyAddingScript || getInteractiveScript();
            if (node) {
                if (!name) {
                    name = node.getAttribute('data-requiremodule');
                }
                context = contexts[node.getAttribute('data-requirecontext')];
            }
        }

        //Always save off evaluating the def call until the script onload handler.
        //This allows multiple modules to be in a file without prematurely
        //tracing dependencies, and allows for anonymous module support,
        //where the module name is not known until the script onload event
        //occurs. If no context, use the global queue, and get it processed
        //in the onscript load callback.
        (context ? context.defQueue : globalDefQueue).push([name, deps, callback]);
    };

    define.amd = {
        jQuery: true
    };


    /**
     * Executes the text. Normally just uses eval, but can be modified
     * to use a better, environment-specific call. Only used for transpiling
     * loader plugins, not for plain JS modules.
     * @param {String} text the text to execute/evaluate.
     */
    req.exec = function (text) {
        /*jslint evil: true */
        return eval(text);
    };

    //Set up with config info.
    req(cfg);
}(this));;/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */
define('mixins', [
    'module'
], function (module) {
    'use strict';

    var rjsMixins;

    /**
     * Checks if specified string contains
     * a plugin spacer '!' substring.
     *
     * @param {String} name - Name, path or alias of a module.
     * @returns {Boolean}
     */
    function hasPlugin(name) {
        return !!~name.indexOf('!');
    }

    /**
     * Adds 'mixins!' prefix to the specified string.
     *
     * @param {String} name - Name, path or alias of a module.
     * @returns {String} Modified name.
     */
    function addPlugin(name) {
        return 'mixins!' + name;
    }

    /**
     * Removes base url from the provided string.
     *
     * @param {String} url - Url to be processed.
     * @param {Object} config - Contexts' configuration object.
     * @returns {String} String without base url.
     */
    function removeBaseUrl(url, config) {
        var baseUrl = config.baseUrl || '',
            index = url.indexOf(baseUrl);

        if (~index) {
            url = url.substring(baseUrl.length - index);
        }

        return url;
    }

    /**
     * Extracts url (without baseUrl prefix)
     * from a modules' name.
     *
     * @param {String} name - Name, path or alias of a module.
     * @param {Object} config - Contexts' configuartion.
     * @returns {String}
     */
    function getPath(name, config) {
        var url = require.toUrl(name);

        return removeBaseUrl(url, config);
    }

    /**
     * Checks if specified string represents a relative path (../).
     *
     * @param {String} name - Name, path or alias of a module.
     * @returns {Boolean}
     */
    function isRelative(name) {
        return !!~name.indexOf('./');
    }

    /**
     * Iterativly calls mixins passing to them
     * current value of a 'target' parameter.
     *
     * @param {*} target - Value to be modified.
     * @param {...Function} mixins
     * @returns {*} Modified 'target' value.
     */
    function applyMixins(target) {
        var mixins = Array.prototype.slice.call(arguments, 1);

        mixins.forEach(function (mixin) {
            target = mixin(target);
        });

        return target;
    }

    rjsMixins = {

        /**
         * Loads specified module along with its' mixins.
         *
         * @param {String} name - Module to be loaded.
         */
        load: function (name, req, onLoad, config) {
            var path     = getPath(name, config),
                mixins   = this.getMixins(path),
                deps     = [name].concat(mixins);

            req(deps, function () {
                onLoad(applyMixins.apply(null, arguments));
            });
        },

        /**
         * Retrieves list of mixins associated with a specified module.
         *
         * @param {String} path - Path to the module (without base url).
         * @returns {Array} An array of paths to mixins.
         */
        getMixins: function (path) {
            var config = module.config() || {},
                mixins = config[path] || {};

            return Object.keys(mixins).filter(function (mixin) {
                return mixins[mixin] !== false;
            });
        },

        /**
         * Checks if specified module has associated with it mixins.
         *
         * @param {String} path - Path to the module (without base url).
         * @returns {Boolean}
         */
        hasMixins: function (path) {
            return this.getMixins(path).length;
        },

        /**
         * Modifies provided names perpending to them
         * the 'mixins!' plugin prefix if it's necessary.
         *
         * @param {(Array|String)} names - Module names, paths or aliases.
         * @param {Object} context - Current requirejs context.
         * @returns {Array|String}
         */
        processNames: function (names, context) {
            var config = context.config;

            /**
             * Prepends 'mixin' plugin to a single name.
             *
             * @param {String} name
             * @returns {String}
             */
            function processName(name) {
                var path = getPath(name, config);

                if (!hasPlugin(name) && (isRelative(name) || rjsMixins.hasMixins(path))) {
                    return addPlugin(name);
                }

                return name;
            }

            return typeof names !== 'string' ?
                names.map(processName) :
                processName(names);
        }
    };

    return rjsMixins;
});

require([
    'mixins'
], function (mixins) {
    'use strict';

    var originalRequire  = window.require,
        originalDefine   = window.define,
        contexts         = originalRequire.s.contexts,
        defContextName   = '_',
        hasOwn           = Object.prototype.hasOwnProperty,
        getLastInQueue;

    getLastInQueue =
        '(function () {' +
            'var queue  = globalDefQueue,' +
                'item   = queue[queue.length - 1];' +
            '' +
            'return item;' +
        '})();';

    /**
     * Returns property of an object if
     * it's not defined in it's prototype.
     *
     * @param {Object} obj - Object whose property should be retrieved.
     * @param {String} prop - Name of the property.
     * @returns {*} Value of the property or false.
     */
    function getOwn(obj, prop) {
        return hasOwn.call(obj, prop) && obj[prop];
    }

    /**
     * Overrides global 'require' method adding to it dependencies modfication.
     */
    window.require = function (deps, callback, errback, optional) {
        var contextName = defContextName,
            context,
            config;

        if (!Array.isArray(deps) && typeof deps !== 'string') {
            config = deps;

            if (Array.isArray(callback)) {
                deps = callback;
                callback = errback;
                errback = optional;
            } else {
                deps = [];
            }
        }

        if (config && config.context) {
            contextName = config.context;
        }

        context = getOwn(contexts, contextName);

        if (!context) {
            context = contexts[contextName] = require.s.newContext(contextName);
        }

        if (config) {
            context.configure(config);
        }

        deps = mixins.processNames(deps, context);

        return context.require(deps, callback, errback);
    };

    /**
     * Overrides global 'define' method adding to it dependencies modfication.
     */
    window.define = function (name, deps, callback) { // eslint-disable-line no-unused-vars
        var context     = getOwn(contexts, defContextName),
            result      = originalDefine.apply(this, arguments),
            queueItem   = require.exec(getLastInQueue),
            lastDeps    = queueItem && queueItem[1];

        if (Array.isArray(lastDeps)) {
            queueItem[1] = mixins.processNames(lastDeps, context);
        }

        return result;
    };

    /**
     * Copy properties of original 'require' method.
     */
    Object.keys(originalRequire).forEach(function (key) {
        require[key] = originalRequire[key];
    });

    /**
     * Copy properties of original 'define' method.
     */
    Object.keys(originalDefine).forEach(function (key) {
        define[key] = originalDefine[key];
    });

    window.requirejs = window.require;
});
;(function(require){
(function() {
 var config = {
    map: {
        '*': {
        	 'jQuerymig':'Frame_Design/js/jquery-migrate-1.2.1.min',
        	 'jcanvas':'Frame_Design/lib/bower_components/jcanvas/jcanvas.min',
        	 'jcanvasHandle':'Frame_Design/lib/custom/jcanvas-handles/jcanvas-handles.min',
        	 'bootstrap-min':'Frame_Design/lib/bower_components/bootstrap/dist/js/bootstrap.min',
        	 'spectrum':'Frame_Design/lib/bower_components/spectrum/spectrum',
        	 'slimscroll':'Frame_Design/lib/bower_components/jquery-slimscroll/jquery.slimscroll.min',
        	 'bootbox':'Frame_Design/lib/bower_components/bootbox.js/bootbox',
        	 'noty-pack':'Frame_Design/lib/bower_components/noty/js/noty/packaged/jquery.noty.packaged.min',        	 
        	 'dmgprev':'Frame_Design/js/demo-preview',
        	 'dmuploader':'Frame_Design/js/dmuploader'
        }
    },
    "shim": {
    	"jQuerymig": ["jquery"],
    	"jcanvas": ["jquery"],
    	"jcanvasHandle": ["jquery"],
    	"bootstrap-min": ["jquery"],
    	"spectrum": ["jquery"],
    	"slimscroll": ["jquery"],
    	"bootbox": ["jquery"],
    	"noty-pack": ["jquery"],
    	"dmgprev": ["jquery"],
    	"dmuploader": ["jquery"]
    }
};
require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            checkoutBalance:    'Magento_Customer/js/checkout-balance',
            address:            'Magento_Customer/address',
            changeEmailPassword: 'Magento_Customer/change-email-password',
            passwordStrengthIndicator: 'Magento_Customer/js/password-strength-indicator',
            zxcvbn: 'Magento_Customer/js/zxcvbn'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    "waitSeconds": 0,
    "map": {
        "*": {
            "ko": "knockoutjs/knockout",
            "knockout": "knockoutjs/knockout",
            "mageUtils": "mage/utils/main",
            "rjsResolver": "mage/requirejs/resolver"
        }
    },
    "shim": {
        "jquery/jquery-migrate": ["jquery"],
        "jquery/jquery.hashchange": ["jquery", "jquery/jquery-migrate"],
        "jquery/jstree/jquery.hotkeys": ["jquery"],
        "jquery/hover-intent": ["jquery"],
        "mage/adminhtml/backup": ["prototype"],
        "mage/captcha": ["prototype"],
        "mage/common": ["jquery"],
        "mage/new-gallery": ["jquery"],
        "mage/webapi": ["jquery"],
        "jquery/ui": ["jquery"],
        "MutationObserver": ["es6-collections"],
        "tinymce": {
            "exports": "tinymce"
        },
        "moment": {
            "exports": "moment"
        },
        "matchMedia": {
            "exports": "mediaCheck"
        },
        "jquery/jquery-storageapi": {
            "deps": ["jquery/jquery.cookie"]
        }
    },
    "paths": {
        "jquery/validate": "jquery/jquery.validate",
        "jquery/hover-intent": "jquery/jquery.hoverIntent",
        "jquery/file-uploader": "jquery/fileUploader/jquery.fileupload-fp",
        "jquery/jquery.hashchange": "jquery/jquery.ba-hashchange.min",
        "prototype": "legacy-build.min",
        "jquery/jquery-storageapi": "jquery/jquery.storageapi.min",
        "text": "mage/requirejs/text",
        "domReady": "requirejs/domReady",
        "tinymce": "tiny_mce/tiny_mce_src"
    },
    "deps": [
        "jquery/jquery-migrate"
    ],
    "config": {
        "mixins": {
            "jquery/jstree/jquery.jstree": {
                "mage/backend/jstree-mixin": true
            }
        }
    }
};

require(['jquery'], function ($) {
    $.noConflict();
});

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        "*": {
            "rowBuilder":             "Magento_Theme/js/row-builder",
            "toggleAdvanced":         "mage/toggle",
            "translateInline":        "mage/translate-inline",
            "sticky":                 "mage/sticky",
            "tabs":                   "mage/tabs",
            "zoom":                   "mage/zoom",
            "collapsible":            "mage/collapsible",
            "dropdownDialog":         "mage/dropdown",
            "dropdown":               "mage/dropdowns",
            "accordion":              "mage/accordion",
            "loader":                 "mage/loader",
            "tooltip":                "mage/tooltip",
            "deletableItem":          "mage/deletable-item",
            "itemTable":              "mage/item-table",
            "fieldsetControls":       "mage/fieldset-controls",
            "fieldsetResetControl":   "mage/fieldset-controls",
            "redirectUrl":            "mage/redirect-url",
            "loaderAjax":             "mage/loader",
            "menu":                   "mage/menu",
            "popupWindow":            "mage/popup-window",
            "validation":             "mage/validation/validation",
            "welcome":                "Magento_Theme/js/view/welcome"
        }
    },
    paths: {
        "jquery/ui": "jquery/jquery-ui"
    },
    deps: [
        "jquery/jquery.mobile.custom",
        "js/responsive",
        "mage/common",
        "mage/dataPost",
        "js/theme",
        "mage/bootstrap"
    ]
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            compareItems:           'Magento_Catalog/js/compare',
            compareList:            'Magento_Catalog/js/list',
            relatedProducts:        'Magento_Catalog/js/related-products',
            upsellProducts:         'Magento_Catalog/js/upsell-products',
            productListToolbarForm: 'Magento_Catalog/js/product/list/toolbar',
            catalogGallery:         'Magento_Catalog/js/gallery',
            priceBox:               'Magento_Catalog/js/price-box',
            priceOptionDate:        'Magento_Catalog/js/price-option-date',
            priceOptionFile:        'Magento_Catalog/js/price-option-file',
            priceOptions:           'Magento_Catalog/js/price-options',
            priceUtils:             'Magento_Catalog/js/price-utils',
            catalogAddToCart:       'Magento_Catalog/js/catalog-add-to-cart'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            addToCart: 'Magento_Msrp/js/msrp'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            quickSearch: 'Magento_Search/form-mini'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */
/*jshint browser:true jquery:true*/
/*global alert*/
var config = {
    config: {
        mixins: {
            'Magento_Checkout/js/action/place-order': {
                'Magento_CheckoutAgreements/js/model/place-order-mixin': true
            },
            'Magento_Checkout/js/action/set-payment-information': {
                'Magento_CheckoutAgreements/js/model/set-payment-information-mixin': true
            }
        }
    }
};

require.config(config);
})();
(function() {
var config = {
    map: {
        '*': {
            snapGallery: 'DR_Gallery/js/snapGallery'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            creditCardType: 'Magento_Payment/cc-type'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            requireCookie: 'Magento_Cookie/js/require-cookie',
            cookieNotices: 'Magento_Cookie/js/notices'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            giftMessage:    'Magento_Sales/gift-message',
            ordersReturns:  'Magento_Sales/orders-returns'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            downloadable: 'Magento_Downloadable/downloadable'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            giftOptions:    'Magento_GiftMessage/gift-options',
            extraOptions:   'Magento_GiftMessage/extra-options'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            discountCode:           'Magento_Checkout/js/discount-codes',
            shoppingCart:           'Magento_Checkout/js/shopping-cart',
            regionUpdater:          'Magento_Checkout/js/region-updater',
            sidebar:                'Magento_Checkout/js/sidebar',
            checkoutLoader:         'Magento_Checkout/js/checkout-loader',
            checkoutData:           'Magento_Checkout/js/checkout-data',
            proceedToCheckout:      'Magento_Checkout/js/proceed-to-checkout'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    paths: {
        'ui/template': 'Magento_Ui/templates'
    },
    map: {
        '*': {
            uiElement:      'Magento_Ui/js/lib/core/element/element',
            uiCollection:   'Magento_Ui/js/lib/core/collection',
            uiComponent:    'Magento_Ui/js/lib/core/collection',
            uiClass:        'Magento_Ui/js/lib/core/class',
            uiEvents:       'Magento_Ui/js/lib/core/events',
            uiRegistry:     'Magento_Ui/js/lib/registry/registry',
            uiLayout:       'Magento_Ui/js/core/renderer/layout',
            buttonAdapter:  'Magento_Ui/js/form/button-adapter'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            bundleOption:   'Magento_Bundle/bundle',
            priceBundle:    'Magento_Bundle/js/price-bundle',
            slide:          'Magento_Bundle/js/slide',
            productSummary: 'Magento_Bundle/js/product-summary'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            multiShipping: 'Magento_Multishipping/js/multi-shipping',
            orderOverview: 'Magento_Multishipping/js/overview',
            payment: 'Magento_Multishipping/js/payment'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            configurable: 'Magento_ConfigurableProduct/js/configurable'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            pageCache:  'Magento_PageCache/js/page-cache'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            orderReview:            'Magento_Paypal/order-review',
            paypalCheckout:         'Magento_Paypal/js/paypal-checkout'
        }
    },
    paths: {
        paypalInContextExpressCheckout: 'https://www.paypalobjects.com/api/checkout'
    },
    shim: {
        paypalInContextExpressCheckout: {
            exports: 'paypal'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            transparent:            'Magento_Payment/transparent'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */
/*eslint no-unused-vars: 0*/
var config = {
    map: {
        '*': {
            loadPlayer: 'Magento_ProductVideo/js/load-player',
            fotoramaVideoEvents: 'Magento_ProductVideo/js/fotorama-add-video-events'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            captcha: 'Magento_Captcha/captcha'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            recentlyViewedProducts: 'Magento_Reports/js/recently-viewed'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            transparent: 'Magento_Payment/transparent'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            catalogSearch: 'Magento_CatalogSearch/form-mini'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            editTrigger:   'mage/edit-trigger',
            addClass:      'Magento_Translation/add-class'
        }
    },
    deps: [
        'mage/translate-inline'
    ]
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            braintree: 'https://js.braintreegateway.com/js/braintree-2.25.0.min.js'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        "*": {
            "taxToggle": "Magento_Weee/tax-toggle"
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © 2013-2017 Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            wishlist:       'Magento_Wishlist/wishlist',
            addToWishlist:  'Magento_Wishlist/js/add-to-wishlist',
            wishlistSearch: 'Magento_Wishlist/js/search'
        }
    }
};

require.config(config);
})();
(function() {
var config = {
  map: {
    '*': {
      stripejs: 'https://js.stripe.com/v3/'
    }
  }
};
require.config(config);
})();



})(require);;require(['jquery', 'jquery/ui'], function ($) {
	$(document).ready(function () {
		function addClassFooter(){
			var windowHeight = $(window).height();
			var bodyHeight = $("body").height();
			if(windowHeight > bodyHeight){
				$(".copyright").addClass("footerFixed");
			}
			else{
				$(".copyright").removeClass("footerFixed");
			}
		}
		if($(window).width() < 767){ 
			
			addClassFooter();
			$(".block-collapsible-nav-title").click(function(){
				$(".content.block-collapsible-nav-content").slideToggle();
			})
			$("body").click(function(){
				setTimeout(function(){
					var canvasHeight = $("#prevcanv").outerHeight();
					$("#step2 .inside-content, #step3 .inside-content, #step4 .inside-content, #step5 .inside-content, #step6 .inside-content, #step7 .inside-content, #step8 .inside-content, #step9 .inside-content").css('min-height', (canvasHeight + 325));
					//$("#upload-img #prevcanv").css({'top':(canvasHeight-20)});
					if($("#upload-img #prevcanv").hasClass("alterCanvas")){
						var getMenuHeight = $("#upload-img").find("ul.nav").height();
						$("#upload-img #prevcanv.alterCanvas").animate({'top':'760px'});
					}
					else{
						$("#upload-img #prevcanv").animate({'top':'400px'});
					}
				},10);
			});
		}
		
		function footerStaticFixed(){
			if($(".canvas-loader").hasClass("hidden")){
				$(".copyright").addClass("fixedFooter");
			}
			else{
				$(".copyright").removeClass("fixedFooter");
			}
			$("#upload-img").load(function(){
				alert('hi');
			});
		}
		
		function addGridIcon(){
			if($(window).width() < 767){
				$(".navigation").find("ul.ui-menu").css('display','none');
				$(".navigation").append("<div class='toggle-icon'><span></span><span></span><span></span></div>");
				$(".toggle-icon").on('click', function(){
					$(".navigation").find("ul").slideToggle();
				});
				$(".navigation").find("ul.ui-menu a, ul.ui-menu a span").on('click', function(){
					$(".navigation").find("ul.ui-menu").slideUp();
				});
				
				$("#upload-img ul.nav.nav-pills").slideUp();
				$("<div class='tab-menu'>Click and View the Toools Menu</div>").insertBefore("#upload-img ul.nav.nav-pills");
				$(".tab-menu").append("<div class='tab-toggle'><span></span><span></span><span></span></div>");
				$(".tab-menu").on('click', function(){
					$("#upload-img ul.nav.nav-pills").slideToggle();
					$("#prevcanv").toggleClass("alterCanvas");
				});
				$("#upload-img ul.nav.nav-pills a").click(function(){
					$("#upload-img ul.nav.nav-pills").slideUp();
					$("#prevcanv").removeClass("alterCanvas");
				});
				$(".selected-radio-btn").click(function(){
					//$(this).find("input[type='radio']").prop('checked',true);
					//$(this).find("input").trigger("click");
					$(".selected-radio-btn").removeClass("active");
					$(this).addClass("active");
				});
				//footerStaticFixed();
			}
		}
		function clickToTop(){
			$(".down-arrow").click(function(){
				$("body, html").animate({scrollTop:0}, "slow");
			});
		}
		
		function frameslist(){
			var minHeight = 0;
			$("#upload-img ul.frameslist li").each(function(){
				var maxHeight = $(this).height();
				if(maxHeight > minHeight){
					minHeight = maxHeight;
				}
			});
			$("#upload-img ul.frameslist li").css('height', minHeight);
		}
		function topmattlist(){
			var minHeight = 0;
			$("#upload-img ul.topmattlist li").each(function(){
				var maxHeight = $(this).height();
				if(maxHeight > minHeight){
					minHeight = maxHeight;
				}
			});
			$("#upload-img ul.topmattlist li").css('height', minHeight);
		}
		function toolsEqualHeight(){
			$("#upload-img ul.nav.nav-pills li a").click(function(){
				setTimeout(function(){
					topmattlist();
					frameslist();
				},1000);
			});
		}
		/*function leftPanelHeight(){
			if($(window).width() < 767){
				var mainBoxHeight = $("#maincontent").outerHeight();
				$("body.account .inside-middel-section .sidebar.sidebar-main").css('height', mainBoxHeight);
			}
		}
		leftPanelHeight();
		$(window).resize(function () {
			leftPanelHeight();
		});*/
		function topPosition(){
			var boxHeight = $(".flatpanel").outerHeight()/2;
			var boxWidth = $(".flatpanel").outerWidth();
			$(".flatpanel").css('margin-top', -boxHeight);
			$("body").click(function(){
				var boxHeight = $(".flatpanel").outerHeight()/2;
				$(".flatpanel").css('margin-top', -boxHeight);
			});
			$(".flatpanel").css({'right' : -boxWidth});
			$(".arw-open").click(function(){
				$(".flatpanel").animate({'right' : 0},500, function(){
					$(".arw-open").animate({'left':'-40px'},300);
				});
			});
			$("#close").click(function(){
				$(".flatpanel").animate({'right' : -boxWidth},500, function(){
					$(".arw-open").animate({'left':'-74px'},300);
				});
			});
		}
		function openBox(){
			$(".flatpanel").append("<span class='arw-open'>Your Selections</span>")
		}
		function selectAlterFrame(){
			$(".img-place-box").find(".frame-selection").hide();
			$("ul.dropdown-menu").find("li").click(function(){
				$(".img-place-box").find(".frame-selection").hide();
				var getIndex = $(this).index();
				$(".img-place-box").find(".frame-selection").eq(getIndex).show();
			});
		}
		function selectTextFrame(){
			$(".img-place-box").find(".frame-selection span.selected-txt").remove();
			$("ul.dropdown-menu").find("li a").attr('href', 'javascript:void(0)');
			$("ul.dropdown-menu").find("li").click(function(){
				var getIndex = $(this).index();
				$(".img-place-box").find(".frame-selection span.selected-txt").remove();
				$(".img-place-box").find(".frame-selection").eq(getIndex).append("<span class='selected-txt'><i class='fa fa-check-square-o'></i>Selected</span>");
			});
		}
		function getInnerWidth(){
			$("body").click(function(){
				var getPreviewWidth = $("#upload-img").find(".previewcanvas").outerWidth();
				$("#upload-img").find(".previewcanvas").prev(".preview-txt").css('width', getPreviewWidth);
			});
		}
		function clickAlert(){
			$("#btn-next-tab").click(function(){
				var btnValueText = $(this).closest("#upload-img").find(".dropdown-toggle").val();
				if(btnValueText == " "){
					alert('No');
				}
				else{
					alert("Yes");
				}
			});
		}
		function radioSelect(){
			//$(".selected-radio-btn").text('Select');
			$(".selected-radio-btn").find("input[type='radio']").click(function(){
				if($(this).prop("checked") == true){
					$(".selected-radio-btn").removeClass("active");
					$(this).closest(".selected-radio-btn").addClass("active");
				}
			});
			/*$("ul.frameslist li").click(function(){
				$("ul.frameslist li").removeClass("activelist");
				$(this).addClass("activelist");
			});*/
		}
		function previusCanvasHeight(){
			$("body").click(function(){
				setTimeout(function(){
					//var getImgHeight = $(".previewcanvas").find("img").height();
					//$(".previewcanvas").css('min-height', getImgHeight);
					//console.log(getImgHeight);
				},200);
			});
		}
		function tabContentHeight(){
			$("body").click(function(){
				var getCanvasHeight = $("#prevcanv").outerHeight();
				$("#upload-img .tab-content").css('min-height', (getCanvasHeight+40));
				$(".inside-content").css('min-height', (getCanvasHeight-10));
			});
			/*$("a[href='#step9']").click(function(){
				var getInsideImgHeight = $(".previewcanvas").find("img").outerHeight();
				$("#upload-img .tab-content").css('min-height', (getInsideImgHeight+40));
			});*/
		}
		$(window).load(function () {
			addGridIcon();
			clickToTop();
			//toolsEqualHeight();
			topPosition();
			openBox();
			//selectAlterFrame();
			selectTextFrame();
			//getInnerWidth();
			//clickAlert();
			radioSelect();
			previusCanvasHeight();
			tabContentHeight();
		});
		$(window).load(function () {
			topPosition();
		});
	});
});;'use strict';

/*=== @@@START@@@ ALL GLOBAL CONFIG VALUES GOES HERE ====*/
var FRAME_URL = 'http://www.celebrityframing.com/pub/media/frame/';
var BASE_URL = 'http://www.celebrityframing.com/';
var DEFAULT_VALUES = {
	textColor: '#000000',
    topmatesColor:'#2255aa',
    strokecolor:'#f20000',
    fontFamily: 'Arial',
    //fontFamilyFile: '80ea517179b31d69ddedc249859d16df.ttf',
	fontSize: 34,
    defaultFrameWidth: 58,
    defaultFrameID: 2,
    defaultMatt:'B133.jpg',
    defaultSecondMatt:'B459.jpg',
    defaultImage:'sample-image-hor.jpg',
    defaultImageVer:'sample-image-ver.jpg',
    defaultEmbellish:'image28.png',
    defaultPlate:'Gold_Plate_02.png',
    defaultPrice:149.99,
    LayerThickness:10,	
	palette: [
        ["rgb(0, 0, 0)", "rgb(67, 67, 67)", "rgb(102, 102, 102)","rgb(204, 204, 204)", "rgb(217, 217, 217)","rgb(255, 255, 255)"],
        ["rgb(152, 0, 0)", "rgb(255, 0, 0)", "rgb(255, 153, 0)", "rgb(255, 255, 0)", "rgb(0, 255, 0)","rgb(0, 255, 255)", "rgb(74, 134, 232)", "rgb(0, 0, 255)", "rgb(153, 0, 255)", "rgb(255, 0, 255)"], 
        ["rgb(230, 184, 175)", "rgb(244, 204, 204)", "rgb(252, 229, 205)", "rgb(255, 242, 204)", "rgb(217, 234, 211)", 
        "rgb(208, 224, 227)", "rgb(201, 218, 248)", "rgb(207, 226, 243)", "rgb(217, 210, 233)", "rgb(234, 209, 220)", 
        "rgb(221, 126, 107)", "rgb(234, 153, 153)", "rgb(249, 203, 156)", "rgb(255, 229, 153)", "rgb(182, 215, 168)", 
        "rgb(162, 196, 201)", "rgb(164, 194, 244)", "rgb(159, 197, 232)", "rgb(180, 167, 214)", "rgb(213, 166, 189)", 
        "rgb(204, 65, 37)", "rgb(224, 102, 102)", "rgb(246, 178, 107)", "rgb(255, 217, 102)", "rgb(147, 196, 125)", 
        "rgb(118, 165, 175)", "rgb(109, 158, 235)", "rgb(111, 168, 220)", "rgb(142, 124, 195)", "rgb(194, 123, 160)",
        "rgb(166, 28, 0)", "rgb(204, 0, 0)", "rgb(230, 145, 56)", "rgb(241, 194, 50)", "rgb(106, 168, 79)",
        "rgb(69, 129, 142)", "rgb(60, 120, 216)", "rgb(61, 133, 198)", "rgb(103, 78, 167)", "rgb(166, 77, 121)",
        "rgb(91, 15, 0)", "rgb(102, 0, 0)", "rgb(120, 63, 4)", "rgb(127, 96, 0)", "rgb(39, 78, 19)", 
        "rgb(12, 52, 61)", "rgb(28, 69, 135)", "rgb(7, 55, 99)", "rgb(32, 18, 77)", "rgb(76, 17, 48)"]
    ]
};

/*=== @@@END@@@ ALL GLOBAL CONFIG VALUES GOES HERE ====*/;setTimeout(function () {
	require([
		'jquery',"bootbox", "bootstrap-min", "jquery/ui", "jcanvas", "jcanvasHandle", "spectrum", "noty-pack",  "domReady!",'jquery/jquery.cookie'
	], function ($,bootbox) {
		$(document).ready(function () {
			$canvas = $('#mainCanvas');
			var currentTab= 1;
			var dimension = 0;
			var frameUse = '';
			var frameWidth = 0;
			var scale = 1;
			var currentId=DEFAULT_VALUES.defaultFrameID
			var currentWidth=DEFAULT_VALUES.defaultFrameWidth;
			var mattList = '';
			var CanvasSize = {
				width: 600 * scale,
				height: 720 * scale
			};

			var MattSize = {
				width: 600 * scale,
				height: 720 * scale
			};

			var TopBoxSize = {
				width: 402 * scale,
				height: 322 * scale,
				border: DEFAULT_VALUES.LayerThickness * scale
			};

			var EmbillishSize = {
				width: 120 * scale,
				height: 120 * scale
			};

			var PlateSize = {
				width: 201 * scale,
				height: 101 * scale
			};

			var CanvasBackground = {
				type: 'image',
				source: '',
				x: 0,
				y: 0,
				width: MattSize.width + (2 * currentWidth),
				height: MattSize.height + (2 * currentWidth),
				name: 'backgroundframe',
				groups: ['backgroundGrp'],
				fromCenter: false,
				intangible:true,
				load: function (e) {
					$('.canvas-loader').addClass('hidden');
					$('#mainCanvas').removeClass('hidden');
				}
			};

			var CanvasBackgroundLayer = {
					type: 'image',
					source: '',
					x: 0,
					y: 0,
					width: MattSize.width,
					height: MattSize.height,
					name: 'topmatt',
					groups: ['backgroundGrp'],
					fromCenter: false,
					intangible:true,
					load: function (e) {
						$('.canvas-loader').addClass('hidden');
						$('#mainCanvas').removeClass('hidden');
					}
				}

			var TopBoxLayer = {
					type: 'image',
					source: '',
					x: 0,
					y: 0,
					width: TopBoxSize.width + (3 * TopBoxSize.border),
					height: TopBoxSize.height + (3 * TopBoxSize.border),
					fromCenter: false,
					name:'TopboxLayer',
					groups: ['backgroundGrp'],
				}				

			var BaseImageLayer = {
				type: 'image',
				draggable: false,
				source: '',
				x: 0,
				y: 0,
				width: 0,
				height: 0,
				name: '',
				groups: ['backgroundGrp'],
				align: 'center',
				respectAlign: false,
				rotate: 0,
				fromCenter: false,
				constrainProportions: true,
				maxWidth: 0,
				cursors: '',
				visible: true,
				drag: ''
			};

			var BaseTextLayer = {
				fillStyle: '',
				x: 0,
				y: 0,
				fontSize: DEFAULT_VALUES.fontSize,
				fontFamily: DEFAULT_VALUES.fontFamily,
				text: '',
				type: 'text',
				maxWidth: PlateSize.width,
				name: '',
				groups: ['backgroundGrp'],
				rotate: 0,
				radius: 0,
				fromCenter: false,
				layer: true,
				draggable: false,
				align: 'center',
				respectAlign: false,
			};

			/*=== @@@START@@@ DEFAULT INITIALIZATION OF FORM WIDGETS ===*/
			$(function (e) {
				initializeCanvas();
				$('#borderThick').val(DEFAULT_VALUES.LayerThickness);
				$('#fontSize').val(DEFAULT_VALUES.fontSize);
				$('#fontFamilySelected').html(DEFAULT_VALUES.fontFamily);
				$('#prevcanv').hide();
				getEmbellishments();
				getMatt();
				initializeTextBoxFontFamily();
				
				$("#fontSize").bind('change keyup mouseup',function (e) {
					//if(parseInt($(this).val()) < 30 )
						//fs= 30;
					//else
					//alert($(this).val());
					fs=parseInt($(this).val());
					if (typeof getElement(BaseTextLayer.name) != typeof undefined) {					

						updateElement(BaseTextLayer.name, {
							fontSize: fs
						});
						resizeText(e,fs);
						var textSize = $canvas.measureText(BaseTextLayer.name);					
						var newX = (PlateSize.width-textSize.width)/2+$canvas.getLayer('plateLayer').x;
						updateElement(BaseTextLayer.name,{
							x:newX
						});
						$('.previewcanvas').addClass('loadingPreview');
						$('.btn-next').addClass('btn-next-disable');						 
						setTimeout(function() {
							getPreviewCanvas();
						}, 100);
					}					
				});

				$('[data-toggle=tab]').on('show.bs.tab', function (e) {	
					getPreviewCanvas();
				});

				$(".selected-radio-btn").click(function(){
					dimension = $(this).find("input[name='dimention']").val();
					//alert(dimension);
					if(dimension == 1){
						CanvasSize = {
							width: 600 * scale,
							height: 720 * scale
						};
						MattSize = {
							width: 600 * scale,
							height: 720 * scale
						};
						TopBoxSize = {
							width: 402 * scale,
							height: 322 * scale,
							border: DEFAULT_VALUES.LayerThickness * scale
						};
						$('#textaddcls').removeClass('horizontal');
						$('#textaddcls').removeClass('vertical');
						$('#textaddcls').addClass('horizontal');
						$('.previewcanvas').attr('style','width:100%;height:409px');
					}
					else{
						CanvasSize = {
							width: 500 * scale,
							height: 769 * scale
						};
						MattSize = {
							width: 500 * scale,
							height: 769 * scale
						};
						TopBoxSize = {
							width: 309 * scale,
							height: 386 * scale,
							border: DEFAULT_VALUES.LayerThickness * scale
						};
						$('#textaddcls').removeClass('horizontal');
						$('#textaddcls').removeClass('vertical');
						$('#textaddcls').addClass('vertical');
						$('.previewcanvas').attr('style','width:100%;height:510px');
					}
					$(".selected-radio-btn").removeClass("active");
					$(this).addClass("active");
					$(this).find("input[name='dimention']").attr("checked",true);
					initializeCanvas();
					$('.previewcanvas').addClass('loadingPreview');
					$('.btn-next').addClass('btn-next-disable');
					var textSize = $canvas.measureText(BaseTextLayer.name);					
						var newX = (PlateSize.width-textSize.width)/2+$canvas.getLayer('plateLayer').x;
						updateElement(BaseTextLayer.name,{
							x:newX
						});
					getPreviewCanvas();
					$("#dimentionbar").html($(this).find("input[name='dimention']").data('name'));
					$("#dimentionbar").parent('div').addClass('selectClass');
				});

				$('.btn-next-tab').click(function (e) {
					if(dimension != 0){						
						$( 'a[href="#step'+$(this).data("id")+'"]').tab('show');
						$( 'a[href="#step'+$(this).data("id")+'"]' ).removeClass( 'not-active' );
						$( "html, body" ).animate({ scrollTop: 0 }, "slow");					
					}
				});

				$('.framecls').click(function (e) {
					var src= "<img src="+$(this).find('img').attr('src')+" width='100' />";
					$("#framebar").html(src);
					$("#framebar").parent('div').addClass('selectClass');
					generateframe($(this).find('img').data('id'),$(this).find('img').data('width'));
					$('.previewcanvas').addClass('loadingPreview');
					$('.btn-next').addClass('btn-next-disable');
					setTimeout(function() {
						getPreviewCanvas();
					}, 1000);
					$( '#step3 li' ).removeClass( 'active' );
					$(this).parent('li').addClass( 'active' );
				});

				$('#text').bind('keyup mouseup keydown', function (e) {
				
					BaseTextLayer.name = 'textLayer';
					BaseTextLayer.text = $('#text').val();
					BaseTextLayer.width = PlateSize.width;
					BaseTextLayer.height = PlateSize.height;
					BaseTextLayer.x=	$canvas.getLayer('plateLayer').x + 20;
					BaseTextLayer.y=	$canvas.getLayer('plateLayer').y+10;
					var fontFamily = $('#fontFamilySelected').data('value')?$('#fontFamilySelected').data('value') : DEFAULT_VALUES.fontFamily;
					var fontFile = $('#fontFamilySelected').data('file_name')?$('#fontFamilySelected').data('file_name'): DEFAULT_VALUES.fontFile;
					var fontSize = $('#fontSize').val()?$('#fontSize').val() : DEFAULT_VALUES.fontSize;
					var fillStyle = $('#textColor').val() ? $('#textColor').val() : DEFAULT_VALUES.textColor;
					BaseTextLayer.fontSize= fontSize;
					BaseTextLayer.fillStyle= fillStyle;
					BaseTextLayer.fontFamily= fontFamily;
					if($('#text').val().length == 0){
						$('#fontSize').val(DEFAULT_VALUES.fontSize);
					}
					$("#textbar").html($('#text').val());
					$("#textbar").parent('div').addClass('selectClass');
					resizeText(e,fontSize);
					var textSize = $canvas.measureText(BaseTextLayer.name);					
					if (typeof getElement(BaseTextLayer.name) != typeof undefined) {
						updateElement(BaseTextLayer.name, {
							text: $('#text').val(),
							width: PlateSize.width,
							height:	PlateSize.height,
							fontSize: BaseTextLayer.fontSize,
							fontFamily: BaseTextLayer.fontFamily,
							x: BaseTextLayer.x,
							y: BaseTextLayer.y
						});
					} else {
						addElement(BaseTextLayer);
					}				
					var newX = (PlateSize.width-textSize.width)/2+$canvas.getLayer('plateLayer').x;
					updateElement(BaseTextLayer.name,{
						x:newX
					});
					$('.previewcanvas').addClass('loadingPreview');
					$('.btn-next').addClass('btn-next-disable');
					setTimeout(function() {
						getPreviewCanvas();
					}, 100);

				});				
				function resizeText(e,fontSize){
					var textSize = $canvas.measureText(BaseTextLayer.name);
					if(textSize.width+2 >= PlateSize.width || textSize.height+2 >= PlateSize.height){						
							fontSize--;
							$('#fontSize').val(fontSize);
							updateElement( BaseTextLayer.name, { fontSize: fontSize});
							console.log("fontSize",fontSize);
							resizeText(e, fontSize);
					}
					
					// else if(textSize.width+2 < PlateSize.width || textSize.height+2 < PlateSize.height){						
					// 		fontSize++;
					// 		$('#fontSize').val(fontSize);
					// 		updateElement( BaseTextLayer.name, { fontSize: fontSize});
					// 		resizeText(e, fontSize);
					// }
				}
				// TOGGLE FONT FAMILY DROPDOWN
				$('#fontFamilySelected').click(function (e) {
					$('#fontFamily').toggleClass('hidden');
				});

				// UPDATE CANVAS TEXT ON FONT FAMILY CHANGE
				$('body').on('click', 'div#fontFamily ul li', function (e) {

					var fontFamily = $(this).data('value');	

					if ($('#fontFamilySelected').data('value') != fontFamily) {

						$('#fontFamilySelected').css('fontFamily', fontFamily);

						$('#fontFamilySelected').data('value', fontFamily);					

						$('#fontFamilySelected').html($(this).html());

						if (typeof getElement(BaseTextLayer.name) != typeof undefined) {

							updateElement(BaseTextLayer.name, {

								fontFamily: fontFamily

							});

						}

						$('#fontFamily').addClass('hidden');
						$('.previewcanvas').addClass('loadingPreview');
						$('.btn-next').addClass('btn-next-disable');
						setTimeout(function() {

							getPreviewCanvas();

						}, 100);
					}

				});

				$('body').on('click', 'ul.topmattlist li', function (e) {

					var src= "<img src="+$(this).find('img').data('src')+" width='100' id='selmattimg' />";					

					$("#topmattbar").html(src);

					$("#topmattbar").parent('div').addClass('selectClass');

					CanvasBackgroundLayer.source = $(this).find('img').data('src');

					source = CanvasBackgroundLayer.source;

					CanvasBackgroundLayer.x=currentWidth;

					CanvasBackgroundLayer.y=currentWidth; 

					if (typeof getElement('topmatt') != typeof undefined) {

						updateElement(CanvasBackgroundLayer.name, {

							source: source,

							x:currentWidth,

							y:currentWidth							

						});						

					} else {						

						addElement(CanvasBackgroundLayer);				

					}
					$('.previewcanvas').addClass('loadingPreview');
					$('.btn-next').addClass('btn-next-disable');
					setTimeout(function() {

						getPreviewCanvas();

					}, 1000);
					$( '#step4 li' ).removeClass( 'active' );
					$(this).addClass( 'active' );
				});

				$('body').on('click', 'ul.bottommattlist li', function (e) {

					var src= "<img src="+$(this).find('img').data('src')+" width='100' id='selsecmattimg' />";					

					$("#bottommattbar").html(src);

					$("#bottommattbar").parent('div').addClass('selectClass');

					TopBoxLayer.source = $(this).find('img').data('src');

					TopBoxLayer.x = currentWidth + ((MattSize.width/2)- (boxWidth/2));

					TopBoxLayer.y = currentWidth + ((MattSize.height/6)- (boxHeight/6));

					if (typeof getElement('topmatt') != typeof undefined) {

						updateElement(TopBoxLayer.name, {

							source: TopBoxLayer.source,

							x:TopBoxLayer.x,

							y:TopBoxLayer.y							

						});						

					} else {						

						addElement(TopBoxLayer);				

					}
					$('.previewcanvas').addClass('loadingPreview');
					$('.btn-next').addClass('btn-next-disable');
					setTimeout(function() {

						getPreviewCanvas();

					}, 1000);
					$( '#step5 li' ).removeClass( 'active' );
					$(this).addClass( 'active' );

				});

				$('.platelist').click(function (e) {
					var src= "<img src="+$(this).find('img').data('src')+" width='100' />";
					$("#platebar").html(src);
					$("#platebar").parent('div').addClass('selectClass');
					$( '#step8 li' ).removeClass( 'active' );
					$(this).parent('li').addClass( 'active' );
					$('.previewcanvas').addClass('loadingPreview');
					$('.btn-next').addClass('btn-next-disable');
					setTimeout(function() {
						getPreviewCanvas();
					}, 1000);
				});

				$('#image-files').click(function (e) {
					if(typeof $('#uploadImgPath').attr('src') === typeof undefined)
						return false;
					BaseImageLayer.name = 'uploadImageLayer';
					BaseImageLayer.source = $('#uploadImgPath').attr('src');
					BaseImageLayer.width = TopBoxSize.width+10;
					BaseImageLayer.height = TopBoxSize.height+10;
					BaseImageLayer.x=	currentWidth + ((MattSize.width/2)- (TopBoxSize.width/2))-4;
					BaseImageLayer.y=	currentWidth + ((MattSize.height/6)- (TopBoxSize.height/6))+7;
					if (typeof getElement('uploadImageLayer') != typeof undefined) {
						source=$('#uploadImgPath').attr('src');
						updateElement(BaseImageLayer.name, {
							source: source,
							width: BaseImageLayer.width,
							height:	BaseImageLayer.height,
							x: BaseImageLayer.x,
							y: BaseImageLayer.y
						});			

					} else {
						addElement(BaseImageLayer);
					}
					$('.previewcanvas').addClass('loadingPreview');
					$('.btn-next').addClass('btn-next-disable');
					setTimeout(function() {
						getPreviewCanvas();
					}, 1000);
				});

				$('body').on('click', 'div#embellishListBody ul.emilishlist li', function (e) {			

					var img = new Image();
					img.src = $(this).find('img').data('src');
					dataImg = $(this).find('img').data('src');
					$( '#step6 li' ).removeClass( 'active' );
					$(this).addClass( 'active' );
					img.onload = function() {
						EmbillishSize.width=Math.ceil((this.width / this.height)*EmbillishSize.height);
						BaseImageLayer.name = 'embillishLayer';
						BaseImageLayer.source = img.src;
						BaseImageLayer.width = EmbillishSize.width;
						BaseImageLayer.height = EmbillishSize.height;
						BaseImageLayer.x=	currentWidth + ((MattSize.width/2)- (EmbillishSize.width/2));
						BaseImageLayer.y=	$canvas.getLayer('uploadImageLayer').y + $canvas.getLayer('uploadImageLayer').height + 25;
						if (typeof getElement('embillishLayer') != typeof undefined) {
							updateElement(BaseImageLayer.name, {
								source: BaseImageLayer.source,
								width: EmbillishSize.width,
								height:	BaseImageLayer.height,
								x: BaseImageLayer.x,
								y: BaseImageLayer.y
							});
						} else {
							addElement(BaseImageLayer);	
						}
						var src= "<img src="+ dataImg +" width='100' id='embilishsidelay' />";
						$("#embilshbar").html(src);
						$("#embilshbar").parent('div').addClass('selectClass');						
						$('.previewcanvas').addClass('loadingPreview');
						$('.btn-next').addClass('btn-next-disable');
						setTimeout(function() {
							getPreviewCanvas();
						}, 1000);
					}
				});

				$('body').on('click', 'ul.platelist li', function (e) {

					BaseImageLayer.name = 'plateLayer';

					BaseImageLayer.source = $(this).find('img').attr('src');

					BaseImageLayer.width = PlateSize.width;

					BaseImageLayer.height = PlateSize.height;

					BaseImageLayer.x=	currentWidth + ((MattSize.width/2)- (PlateSize.width/2));

					BaseImageLayer.y=	$canvas.getLayer('uploadImageLayer').y + $canvas.getLayer('uploadImageLayer').height + $canvas.getLayer('embillishLayer').height + 50;

					if (typeof getElement('plateLayer') != typeof undefined) {

						updateElement(BaseImageLayer.name, {

							source: BaseImageLayer.source,

							width: BaseImageLayer.width,

							height:	BaseImageLayer.height,

							x: BaseImageLayer.x,

							y: BaseImageLayer.y					

						});						

					} else {						

						addElement(BaseImageLayer);				

					}
					$( '#step7 li' ).removeClass( 'active' );
					$(this).addClass( 'active' );
					//$( 'a[href="#step8"]' ).removeClass( 'not-active' );

					//$( '[data-toggle="tab"][href="#step8"]' ).trigger( 'click' );

				});

				$("#textColor").spectrum({

					color: DEFAULT_VALUES.textColor,

					className: "full-spectrum",

					showInitial: true,

					showPalette: true,

					showSelectionPalette: true,

					maxSelectionSize: 10,

					preferredFormat: "hex",

					palette: DEFAULT_VALUES.palette,

					hide: function (color) {

						console.log("Text Color Changed Onclick", color.toHexString());						

						updateElement(BaseTextLayer.name, {

							fillStyle: color.toHexString()

						});

					}

				});	

			});

			/*=== @@@START@@@ COMMON LOGIC ===*/
			// ADD ANY ELEMENT ON CANVAS
			function addElement(element) {
				if ($.isArray(element)) {
					for (var i = 0; i < element.length; i++) {
						$canvas.addLayer(element[i]).drawLayers();
					}
				} else {
					console.log(element);
					$canvas.addLayer(element).drawLayers();
					$canvas.moveLayer(CanvasBackground.name, $canvas.getLayers().length - 1);
					$canvas.moveLayer(CanvasBackgroundLayer.name, 0);
				}
			}

			// REMOVE ANY ELEMENT ON CANVAS
			function deleteElement(elementName, isGroup) {

				var isGroup = typeof isGroup !== 'undefined' ? isGroup : false;

				isGroup ? $canvas.removeLayerGroup(elementName).drawLayers() : $canvas.removeLayer(elementName).drawLayers();

			}

			// UPDATE ANY ELEMENT ON CANVAS
			function updateElement(elementName, obj, isGroup) {

				var isGroup = typeof isGroup !== 'undefined' ? isGroup : false;

				isGroup ? $canvas.setLayerGroup(elementName, obj).drawLayers() : $canvas.setLayer(elementName, obj).drawLayers();

			}

			// GET DETAILS OF ANY ELEMENT ON CANVAS
			function getElement(elementName, isGroup) {
				var isGroup = typeof isGroup !== 'undefined' ? isGroup : false;
				return isGroup ? $canvas.getLayerGroup(elementName) : $canvas.getLayer(elementName);
			}

			// GENERAL FUNCTION FOR MESSAGE NOTIFICATION
			function notifyMessage(message, type) {

				$.noty.closeAll();

				var n = noty({

					text: message,

					type: type,

					theme: 'relax',

					timeout: 5000,

					animation: {

						open: 'animated bounceInDown',

						close: 'animated bounceOutUp',

						easing: 'swing',

						speed: 500

					}

				});

			}

			function getPreviewCanvas() {
				var newwidth = newheight=0;
				if(dimension == 1){
					newwidth=400;
					newheight=480;
				}
				else{
					newwidth=300;
					newheight=461;
				}
				var img="<img src='"+$('#mainCanvas').getCanvasImage('png')+"' width='"+newwidth+"' height='"+newheight+"'>";
				$('.previewcanvas').html(img);
				$('.previewcanvas').removeClass('loadingPreview');
				$('.btn-next').removeClass('btn-next-disable');
			}

			
			function initializeTextBoxFontFamily() {
				var url = BASE_URL+'design/FrameDesign/';				
				$.ajax({
					type: 'GET',
					url: url,
					data: { "type":'family'},
					beforeSend: function () {},
					success: function (response) {						
						var optionHtml = '';
						for (indx in response) {
							optionHtml += '<li style="font-family:\'' + response[indx].family + '\';" data-value="' + response[indx].family + '">' + response[indx].name + '</li>';
						}
						$('#fontFamily ul').html(optionHtml);
					},
					error: function (response) {
						response = response.responseText;
						response = JSON.parse(response);
					}
				});
			}

			// GENERAL FUNCTION FOR CANVAS MESSAGE NOTIFICATION
			function notifyCanvasMessage(message, type) {

				canvasNoty = $('.box-wrap .noty-loader').noty({

					text: message,

					type: type,

					theme: 'relax',

					animation: {

						open: 'animated flipInX',

						close: 'animated flipOutX',

						easing: 'swing',

						speed: 500

					}

				});

			}

			// INITIALIZE CANVAS AT FIRST LOAD TIME
			function initializeCanvas() {
				if (typeof currentId != typeof undefined) {
					id=currentId;
					width=currentWidth;	
				}
				else if($.cookie('frameId')){
					var t = ($.cookie('frameId')).split("@");
					id = t[0];
					width = t[1];
				}
				else if (typeof id === typeof undefined) {
					id = DEFAULT_VALUES.defaultFrameID;
					width = DEFAULT_VALUES.defaultFrameWidth;
				}
				generateframe(id,width);
			}

			function generateframe(id,width){
				currentWidth=width;
				currentId=id;
				$('#framewidth').val(currentWidth);
				$('#frameId').val(currentId);
				$('#mainCanvas').attr('width', CanvasSize.width + (2 * width));
				$('#mainCanvas').attr('height', CanvasSize.height + (2 * width));
				$('#previewCanvas').attr('width',CanvasSize.width + (2 * width));
				$('#previewCanvas').attr('height',CanvasSize.height + (2 * width));	
				CanvasBackground.source = FRAME_URL+id+".png";
				CanvasBackground.width = CanvasSize.width + (2 * width);

				CanvasBackground.height = CanvasSize.height + (2 * width);

				CanvasBackground.fromCenter = false;

				if (typeof getElement(CanvasBackground.name) != typeof undefined) {

					updateElement(CanvasBackground.name, {

						source: CanvasBackground.source,

						width:CanvasBackground.width,

						height:CanvasBackground.height						

					});	

				} 

				else {										

					addElement(CanvasBackground);

				}
				
				if ($('#selmattimg').attr('src') == undefined)  {
					CanvasBackgroundLayer.source = FRAME_URL+"matt/"+DEFAULT_VALUES.defaultMatt;
				}
				else{
					CanvasBackgroundLayer.source = $('#selmattimg').attr('src');
				}
				CanvasBackgroundLayer.width = MattSize.width;

				CanvasBackgroundLayer.height = MattSize.height;

				CanvasBackgroundLayer.x = currentWidth;

				CanvasBackgroundLayer.y = currentWidth;

				if (typeof getElement(CanvasBackgroundLayer.name) != typeof undefined) {

					updateElement(CanvasBackgroundLayer.name, {	

						source:	CanvasBackgroundLayer.source,				

						width: MattSize.width,

						height: MattSize.height,

						x: CanvasBackgroundLayer.x,

						y: CanvasBackgroundLayer.y					

					});	

				}
				else {										

					addElement(CanvasBackgroundLayer);

				}
				
				boxWidth=TopBoxSize.width + (3 * TopBoxSize.border);

				boxHeight = TopBoxSize.height + (3 * TopBoxSize.border);

				TopBoxLayer.width = boxWidth+2;

				TopBoxLayer.height = boxHeight+6;

				TopBoxLayer.x = currentWidth + ((MattSize.width/2)- (boxWidth/2));

				TopBoxLayer.y = currentWidth + ((MattSize.height/6)- (boxHeight/6));

				if ($('#selsecmattimg').attr('src') == undefined)  {
					TopBoxLayer.source = FRAME_URL+"matt/"+DEFAULT_VALUES.defaultSecondMatt;
				}
				else{
					TopBoxLayer.source = $('#selsecmattimg').attr('src');
				}

				

				if (typeof getElement(TopBoxLayer.name) != typeof undefined) {

					updateElement(TopBoxLayer.name, {							

						width: TopBoxLayer.width,

						height: TopBoxLayer.height,

						x: TopBoxLayer.x,

						y: TopBoxLayer.y						

					});	

				}				
				else {										
					addElement(TopBoxLayer);

				}
				//Manage Image Layer
				if ($('#uploadImgPath').attr('src') == undefined)  {
					if(dimension == 1)
						BaseImageLayer.source = FRAME_URL + DEFAULT_VALUES.defaultImage;
					else
						BaseImageLayer.source = FRAME_URL + DEFAULT_VALUES.defaultImageVer;
				}
				else{
					BaseImageLayer.source = $('#uploadImgPath').attr('src');
				}

				BaseImageLayer.width = TopBoxSize.width+10;

				BaseImageLayer.height = TopBoxSize.height+10;

				BaseImageLayer.x=	currentWidth + ((MattSize.width/2)- (TopBoxSize.width/2))-3;

				BaseImageLayer.y=	currentWidth + ((MattSize.height/6)- (TopBoxSize.height/6))+8;

				if (typeof getElement('uploadImageLayer') != typeof undefined) {								

					updateElement('uploadImageLayer', {
						source: BaseImageLayer.source,
						width: BaseImageLayer.width,
						height:	BaseImageLayer.height,
						x: BaseImageLayer.x,
						y: BaseImageLayer.y
					});
				}
				else {										
					BaseImageLayer.name='uploadImageLayer';
					addElement(BaseImageLayer);

				}
				//Manage Embillishment Layer
				var width = EmbillishSize.width;
				if ($('#embilishsidelay').attr('src') == undefined)  {
					BaseImageLayer.source = BASE_URL + "pub/media/gallery/image/" + DEFAULT_VALUES.defaultEmbellish;
					width = 194;
				}
				else{
					BaseImageLayer.source = $('#embilishsidelay').attr('src');
				}
				BaseImageLayer.width = width;
				BaseImageLayer.height = EmbillishSize.height;
				BaseImageLayer.x=	currentWidth + ((MattSize.width/2)- (BaseImageLayer.width/2));
				BaseImageLayer.y=	$canvas.getLayer('uploadImageLayer').y + $canvas.getLayer('uploadImageLayer').height+25;			

				if (typeof getElement('embillishLayer') != typeof undefined) {
					updateElement('embillishLayer', {
						source: BaseImageLayer.source,
						width: BaseImageLayer.width,
						height:	BaseImageLayer.height,
						x: BaseImageLayer.x,
						y: BaseImageLayer.y
					});
				}
				else{
					BaseImageLayer.name='embillishLayer';
					addElement(BaseImageLayer);
				}
				if ($('#platebar').find('img').attr('src') == undefined)  {
					BaseImageLayer.source = FRAME_URL + "plate/" + DEFAULT_VALUES.defaultPlate;
				}
				else{
					BaseImageLayer.source = $('#platebar').find('img').attr('src');
				}
				BaseImageLayer.width = PlateSize.width;
				BaseImageLayer.height = PlateSize.height;
				BaseImageLayer.x=	currentWidth + ((MattSize.width/2)- (PlateSize.width/2));
				BaseImageLayer.y=	$canvas.getLayer('uploadImageLayer').y + $canvas.getLayer('uploadImageLayer').height + $canvas.getLayer('embillishLayer').height + 50;
				if (typeof getElement('plateLayer') != typeof undefined) {
					updateElement('plateLayer', {
						source: BaseImageLayer.source,
						x: BaseImageLayer.x,
						y: 	BaseImageLayer.y
					});
				}
				else {										
					BaseImageLayer.name='plateLayer';
					addElement(BaseImageLayer);
				}
				//Manage Text Layer
				if (typeof getElement(BaseTextLayer.name) != typeof undefined) {
					BaseTextLayer.x=	$canvas.getLayer('plateLayer').x + 20;
					BaseTextLayer.y=	$canvas.getLayer('plateLayer').y + 5;
					updateElement(BaseTextLayer.name, {
						x: BaseTextLayer.x,
						y: BaseTextLayer.y
					});	
				}
			}			

			// EXECUTE ON ENTER PRESS OF SVG CATEGORY SEARCH BOX
			$('body').on('keyup', 'input#searchText', function (e) {
				if (e.keyCode == 13)
					getEmbellishments();
			});

			$('body').on('click', 'button#searchTextButton', function (e) {
				getEmbellishments();
			});	

			// GET ALL SAMPLE CLIPART FROM SERVER BY AJAX CALL
			function getEmbellishments() {
				var searchText = $('#searchText').val();
				var url = BASE_URL+'design/FrameDesign/';
				if ($.trim(searchText) != '') {
					searchText = searchText.replace(/ /g, "+");
				}
				$.ajax({
					type: 'GET',
					url: url,
					dataType:'json',
					data: { "searchText": searchText ,"type":'embellish'},
					beforeSend: function () {
						$('#embellishListBody').html('<div class="text-center"><i class="fa fa-refresh fa-spin" style="font-size:24px"></i> Loading...</div>');
					},
					success: function (response) {
						var fileList = response;
						var html = '';
						if (fileList.length > 0) {
							html+='<ul class="emilishlist">';
							for (var i = 0; i < fileList.length; i++) {
								var newImg= (fileList[i].path).replace("gallery/image/", "gallery/image/small/"); 
								var img_url = BASE_URL+"pub/media/"+newImg;
								var data_img_url = BASE_URL+"pub/media/"+fileList[i].path;
								var img_name = fileList[i].name;
								var img_id = fileList[i].image_id;
								var cls='';
								if(img_id == 31)
									cls="class='active'";
								else
									cls='';
								html += '<li '+cls+'>' +
									'<img src="' + img_url + '" data-src="'+data_img_url+'" alt="" />' +
									'<h2>' + img_name + '</h2>' +
									'</li>';
							}
							html+='</ul>';
						} else {
							html = '<div class="text-center">No embellishments found.</div>';
						}
						$('#embellishListBody').html(html);
					},
					error: function () {}
				});
			}

			function getMatt() {
				var url = BASE_URL+'design/FrameDesign/';
				$.ajax({
					type: 'GET',
					url: url,
					dataType:'json',
					data: { "type":'matt'},
					beforeSend: function () {
						$('#MattListBody').html('<div class="text-center"><i class="fa fa-refresh fa-spin" style="font-size:24px"></i> Loading...</div>');
					},
					success: function (response) {
						var fileList = response;
						mattList = fileList
						var html = '';
						if (fileList.length > 0) {
							html+='<ul class="topmattlist">';
							for (var i = 0; i < fileList.length; i++) {								
								var img_url = FRAME_URL+"matt/small/"+fileList[i].Image;
								var data_img_url = FRAME_URL+"matt/"+fileList[i].Image;
								var img_name = fileList[i].Name;
								var cls='';
								if(fileList[i].Image == DEFAULT_VALUES.defaultMatt)
								 cls = 'class="active"';
								else
								 cls = '';
								html += '<li '+cls+'>' +
									'<img  class="mattimg" src="' + img_url + '" data-src="'+data_img_url+'" alt="" width="84" height="47" />' +
									'<h2>' + img_name + '</h2>' +
									'</li>';
							}
							html+='</ul>';
						} else {
							html = '<div class="text-center">No Matt found.</div>';
						}
						$('#MattListBody').html(html);
						getSecondMatt();
					},
					error: function () {}
				});
			}

			function getSecondMatt() {
				var fileList = mattList;
				var html = '';
				if (fileList.length > 0) {
					html+='<ul class="bottommattlist">';
					for (var i = 0; i < fileList.length; i++) {						
						var img_url = FRAME_URL+"matt/small/"+fileList[i].Image;
						var data_img_url = FRAME_URL+"matt/"+fileList[i].Image;
						var img_name = fileList[i].Name;
						var cls='';
						if(fileList[i].Image == DEFAULT_VALUES.defaultSecondMatt)
							cls = 'class="active"';
						else
							cls = '';
						html += '<li '+cls+'>' +
							'<img  class="mattimg" src="' + img_url + '" data-src="'+data_img_url+'" alt="" width="84" height="47" />' +
							'<h2>' + img_name + '</h2>' +
							'</li>';
					}
					html+='</ul>';
				} else {
					html = '<div class="text-center">No Matt found.</div>';
				}
				$('#MattSecondListBody').html(html);
			}				

			$('#saveCanvas').click( function(e){
				var topmatt = bottommatt = image= embillish = plate = background = text = fontsize = '';
				var c = $canvas.getLayers();
				$.each( c, function( key, value ) {
					  var res = c[key].source;
					  if(c[key].name == "topmatt"){				  	
						topmatt=res;
					  }
					  else if(c[key].name == "TopboxLayer"){
						bottommatt=res;
					  }
					  else if(c[key].name == "uploadImageLayer"){
						image=res;
					  }
					  else if(c[key].name == "embillishLayer"){
						embillish=res;
					  }
					  else if(c[key].name == "plateLayer"){
						plate=res;
					  }
					  else if(c[key].name == "textLayer"){
						text=c[key].text;
						fontsize=c[key].fontSize;
						fontfamily=c[key].fontFamily;
					  }
					  else if(c[key].name == "backgroundframe"){
						background=res;
					  }
				});
				$("#dialog-save").dialog({
	                buttons: {
	                    "Yes": function () {
	                        $(this).dialog("close");
							$('#main_wrapper').addClass('hidden');
							$('#load_wrapper').removeClass('hidden');
							var width = $('#framewidth').val();
							var frameId = $('#frameId').val();	
							var data = { 
								canvasimg: $('#mainCanvas').getCanvasImage('png'),
								width:width,
								frameId:frameId,
								price:DEFAULT_VALUES.defaultPrice,
								topmatt:topmatt,
								bottommatt:bottommatt,
								image:image,
								embillish:embillish,
								plate:plate,
								background:background,
								text:text,
								fontsize:fontsize,
								dimension:dimension
							};
							console.log("====",data);
							var url = BASE_URL+'design/FrameDesign/';
							$.ajax({
								type: 'POST',
								url: url,
								dataType:'json',
								data: { "type":'save',data: data },
								beforeSend: function () {},
								success: function (response) {
									var data = response.data;
									window.location.href = BASE_URL+'checkout/cart/';
								},
								error: function(response) {
									response = response.responseText;
									response = JSON.parse(response);
									console.log( response.message);
								}
							});
						
	                    },
	                    "No": function () {
	                        $(this).dialog("close");
	                    }
	                },
	                open: function(event, ui) {
	                    // Get the dialog
	                    var dialog = $(event.target).parents(".ui-dialog.ui-widget");

	                    // Get the buttons
	                    var buttons = dialog.find(".ui-dialog-buttonpane").find("button");

	                    var yesButton = buttons[0];
	                    var noButton = buttons[1];
	                    // Add class to the buttons
	                    $(noButton).addClass("btn-danger");
	                    $(yesButton).addClass("btn-success");
	                }
	            });
	            $("#dialog-save").dialog("open");
				//console.log(CanvasElement);
				// bootbox.confirm({
				// 	message: "Are you done with the Frame Designing? Click <b>Yes</b> to save and proceed to cart or click <b>No</b> to continue editing.",

				// 	buttons: {
				// 		confirm: {
				// 			label: 'Yes',
				// 			className: 'btn-success'
				// 		},
				// 		cancel: {
				// 			label: 'No',
				// 			className: 'btn-danger'
				// 		}
				// 	},
				// 	callback: function (chooseresult) {
				// 		if( chooseresult){
				// 			$('#main_wrapper').addClass('hidden');
				// 			$('#load_wrapper').removeClass('hidden');
				// 			var width = $('#framewidth').val();
				// 			var frameId = $('#frameId').val();	
				// 			var data = { 
				// 				canvasimg: $('#mainCanvas').getCanvasImage('png'),
				// 				width:width,
				// 				frameId:frameId,
				// 				price:DEFAULT_VALUES.defaultPrice,
				// 				topmatt:topmatt,
				// 				bottommatt:bottommatt,
				// 				image:image,
				// 				embillish:embillish,
				// 				plate:plate,
				// 				background:background,
				// 				text:text,
				// 				fontsize:fontsize,
				// 				dimension:dimension
				// 			};
				// 			console.log("====",data);
				// 			var url = BASE_URL+'design/FrameDesign/';
				// 			$.ajax({
				// 				type: 'POST',
				// 				url: url,
				// 				dataType:'json',
				// 				data: { "type":'save',data: data },
				// 				beforeSend: function () {},
				// 				success: function (response) {
				// 					var data = response.data;
				// 					window.location.href = BASE_URL+'checkout/cart/';
				// 				},
				// 				error: function(response) {
				// 					response = response.responseText;
				// 					response = JSON.parse(response);
				// 					console.log( response.message);
				// 				}
				// 			});
				// 		}
				// 	}
				// });
			});

			$('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {				
				if($(e.target).data('id') == 1 || $(e.target).data('id') ==9){
					$('#prevcanv').hide();
				}
				else{
					$('#prevcanv').show();
					$('.custom-pop').addClass('hidden');
					$('#prevcanv').removeClass();
					$('#prevcanv').addClass('col-sm-4 col-md-4 col-lg-4 step'+$(e.target).data('id'));
				}
			});

			$(document).on("contextmenu",function(e){ 
				console.log(e.target); 
             	//e.preventDefault();
			 });	
			
			$('#resetCanvas').click(function (e) {

				$("#dialog-reset").dialog({
	                buttons: {
	                    "Reset": function () {
	                        deleteElement('backgroundGrp', true);				
	                        $(this).dialog("close");
							notifyMessage('The frame has been reset successfully!', 'success');

							setTimeout(function() {

								window.location.href = BASE_URL+'frameeditor/';

							}, 2000);
	                    },
	                    "Cancel": function () {
	                        $(this).dialog("close");
	                    }
	                },
	                open: function(event, ui) {
	                    // Get the dialog
	                    var dialog = $(event.target).parents(".ui-dialog.ui-widget");

	                    // Get the buttons
	                    var buttons = dialog.find(".ui-dialog-buttonpane").find("button");

	                    var resetButton = buttons[0];
	                    var cancelButton = buttons[1];
	                    // Add class to the buttons
	                    $(resetButton).addClass("btn-danger");
	                    $(cancelButton).addClass("btn-success");
	                }
	            });
            	$("#dialog-reset").dialog("open");
				// bootbox.confirm({

				// 	message: "Are you sure you want to reset the frame design?",

				// 	buttons: {

				// 		confirm: {

				// 			label: 'Reset',

				// 			className: 'btn-success'

				// 		},

				// 		cancel: {

				// 			label: 'Cancel',

				// 			className: 'btn-danger'

				// 		}

				// 	},

				// 	callback: function (chooseresult) {

				// 		if( chooseresult){						

				// 			deleteElement('backgroundGrp', true);				

				// 			notifyMessage('The frame has been reset successfully!', 'success');

				// 			setTimeout(function() {

				// 				window.location.href = BASE_URL+'frameeditor/';

				// 			}, 2000);

				// 		}

				// 	}

				// });


			});

			$('.navigation ul li a').click(function(e){

				var href = $(this).attr('href');

				e.preventDefault(); 
				$("#dialog-leavePage").dialog({
	                buttons: {
	                    "Leave Page": function () {
	                        window.location.href = href;
	                    },
	                    "Stay on page": function () {
	                        $(this).dialog("close");
	                        return true;
	                    }
	                },
	                open: function(event, ui) {
	                    // Get the dialog
	                    var dialog = $(event.target).parents(".ui-dialog.ui-widget");

	                    // Get the buttons
	                    var buttons = dialog.find(".ui-dialog-buttonpane").find("button");

	                    var leaveButton = buttons[0];
	                    var stayButton = buttons[1];
	                    // Add class to the buttons
	                    $(leaveButton).addClass("btn-danger");
	                    $(stayButton).addClass("btn-success");
	                }
	            });
	            $("#dialog-leavePage").dialog("open");
				// bootbox.confirm({

				// 	message: "Are you sure you want to leave this page? If you leave this page now, your current frame design will be discarded. Click <b>Stay on page</b> to continue editing, or <b>Leave Page</b> to discard the changes.",

				// 	buttons: {

				// 		confirm: {

				// 			label: 'Leave Page',

				// 			className: 'btn-success'

				// 		},

				// 		cancel: {

				// 			label: 'Stay on page',

				// 			className: 'btn-danger'

				// 		}

				// 	},

				// 	callback: function (chooseresult) {

				// 		if( chooseresult){

				// 			window.location.href = href;

				// 		}

				// 		else

				// 			return true;

				// 	}

				// });

			});

			$('.logo').click(function(e){ 
				var href = $(this).attr('href');
				e.preventDefault();
				$("#dialog-leavePage").dialog({
	                buttons: {
	                    "Leave Page": function () {
	                        window.location.href = href;
	                    },
	                    "Stay on page": function () {
	                        $(this).dialog("close");
	                        return true;
	                    }
	                },
	                open: function(event, ui) {
	                    // Get the dialog
	                    var dialog = $(event.target).parents(".ui-dialog.ui-widget");

	                    // Get the buttons
	                    var buttons = dialog.find(".ui-dialog-buttonpane").find("button");

	                    var leaveButton = buttons[0];
	                    var stayButton = buttons[1];
	                    // Add class to the buttons
	                    $(leaveButton).addClass("btn-danger");
	                    $(stayButton).addClass("btn-success");
	                } 
	            });
	            $("#dialog-leavePage").dialog("open");
				// bootbox.confirm({
				// 	message: "Are You sure leave this page? Click <b>Leave Page</b>. If you leave this page your current Frame design no longer exists",
				// 	buttons: {
				// 		confirm: {
				// 			label: 'Leave Page',
				// 			className: 'btn-success'
				// 		},
				// 		cancel: {
				// 			label: 'Stay on page',
				// 			className: 'btn-danger'
				// 		}
				// 	},
				// 	callback: function (chooseresult) {
				// 		if( chooseresult){
				// 			window.location.href = href;
				// 		}
				// 		else
				// 			return true;
				// 	}
				// });
			});
		});
	});

}, 4000);;setTimeout(function () {

    require([

        'jquery', "bootstrap-min", "jquery/ui", "slimscroll", "domReady!"

    ], function ($) {



        $(function (e) {

            'use strict';



            // Custom popup draggable in the whole window

            $(".custom-pop").draggable({

                handle: ".heading-txt",

                containment: "#main_wrapper"

            });



            // Custom scrollbar in the product list

            $('#framediv').slimScroll({

                height: '455px'

            });        



            // Custom scrollbar in the image list

            $('#mattdiv').slimScroll({

                height: '450px'

            });

             $('#smattdiv').slimScroll({

                height: '450px'

            });

            // Custom scrollbar in the clipart list

            $('#embellishListBody').slimScroll({

                height: '415px'

            });           



            $(function (e) {

                $('[data-toggle="tooltip"]').tooltip()

            });



        });





    });

}, 3000);