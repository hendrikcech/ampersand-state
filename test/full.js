var tape = require('tape');
var State = require('../ampersand-state');
var AmpersandRegistry = require('ampersand-registry');
var Collection = require('ampersand-collection');
var definition, Foo, registry;


// wrap test so we always run reset first
var test = function () {
    reset();
    tape.apply(tape, arguments);
};

function reset() {
    registry = new AmpersandRegistry();

    definition = {
        type: 'foo',
        props: {
            id: 'number',
            firstName: ['string', true, 'defaults'],
            lastName: ['string', true],
            thing: {
                type: 'string',
                required: true,
                default: 'hi'
            },
            num: ['number', true],
            today: ['date'],
            hash: ['object'],
            list: ['array'],
            myBool: ['boolean', true, false],
            someNumber: {type: 'number', allowNull: true},
            good: {
                type: 'string',
                test: function (newVal) {
                    if (newVal !== 'good') {
                        return "Value not good";
                    }
                }
            }
        },
        session: {
            active: ['boolean', true, true]
        },
        derived: {
            name: {
                deps: ['firstName', 'lastName'],
                fn: function () {
                    return this.firstName + ' ' + this.lastName;
                }
            },
            initials: {
                deps: ['firstName', 'lastName'],
                cache: false,
                fn: function () {
                    // This currently breaks without both deps being set
                    if (this.firstName && this.lastName) {
                        return (this.firstName.charAt(0) + this.lastName.charAt(0)).toUpperCase();
                    }
                    return '';
                }
            },
            isCrazy: {
                deps: ['crazyPerson'],
                fn: function () {
                    return !!this.crazyPerson;
                }
            }
        },
        // add a reference to the registry
        registry: registry
    };

    Foo = State.extend(definition);
}


test('should get the derived value', function (t) {
    var foo = new Foo({
        firstName: 'jim',
        lastName: 'tom'
    });
    foo.firstName = 'jim';
    foo.lastName = 'tom';

    t.strictEqual(foo.name, 'jim tom');
    t.strictEqual(foo.initials, 'JT');
    t.end();
});

test('should be sealable', function (t) {
    definition.seal = true;
    var Bar = State.extend(definition);
    var bar = new Bar();
    t.throws(function () {
        "use strict";
        // detect if strict mode worked
        var isStrict = (function () { return !this; })();
        bar.someProperty = 'new';
        // throw type error to be able to test in browsers
        // that don't support strict
        if (!isStrict) throw TypeError;
    }, TypeError, 'Throws exception in strict mode.');
    bar.someOtherProperty = 'something';
    t.ok(!bar.someOtherProperty, 'ignores properties otherwise');
    t.end();
});

test('should have default values for properties', function (t) {
    var foo = new Foo({
        firstName: 'jim',
        lastName: 'tom'
    });
    t.strictEqual(foo.myBool, false);
    t.end();
});

test('should throw an error setting a derived prop', function (t) {
    var foo = new Foo();
    try { foo.name = 'bob'; }
    catch (err) { t.ok(err instanceof TypeError); }
    t.end();
});

test('Error when setting derived property should be helpful', function (t) {
    var foo = new Foo();
    try { foo.name = 'bob'; }
    catch (err) {
        t.equal(err.message, "\"name\" is a derived property, it can't be set directly.");
    }
    t.end();
});

test('should get correct defaults', function (t) {
    var foo = new Foo({});
    t.strictEqual(foo.firstName, 'defaults');
    t.strictEqual(foo.thing, 'hi');
    t.end();
});

test('Setting other properties when `extraProperties: "reject"` throws error', function (t) {
    var Foo = State.extend({
        extraProperties: 'reject'
    });
    var foo = new Foo();
    t.throws(function () {
        foo.set({
            craziness: 'new'
        });
    }, Error, 'Throws exception if set to rejcet');
    t.end();
});

test('Setting other properties ignores them by default', function (t) {
    var foo = new Foo();
    foo.set({
        craziness: 'new'
    });
    t.strictEqual(foo.craziness, undefined, 'property should be ignored');
    t.end();
});

test('Setting other properties is ok if allowOtherProperties is true', function (t) {
    var foo = new Foo();
    foo.extraProperties = 'allow';
    foo.set({
        craziness: 'new'
    });
    t.equal(foo.get('craziness'), 'new');
    t.end();
});

test('should throw a type error for bad data types', function (t) {
    t.throws(function () {
        new Foo({firstName: 3});
    }, TypeError);
    t.throws(function () {
        new Foo({num: 'foo'});
    }, TypeError);
    t.throws(function () {
        new Foo({hash: 10});
    }, TypeError);
    t.throws(function () {
        new Foo({today: 'asdfadsfa'});
    }, TypeError);
    t.doesNotThrow(function () {
        new Foo({today: 1397631169892});
        new Foo({today: '1397631169892'});
    });
    t.throws(function () {
        new Foo({list: 10});
    }, TypeError);
    t.end();
});

test('should validate model', function (t) {
    var foo = new Foo();
    t.equal(foo._verifyRequired(), false);

    foo.firstName = 'a';
    foo.lastName = 'b';
    foo.thing = 'abc';
    foo.num = 12;
    t.ok(foo._verifyRequired());
    t.end();
});

test('should store previous attributes', function (t) {
    var foo = new Foo({
        firstName: 'beau'
    });
    foo.firstName = 'john';
    t.strictEqual(foo.firstName, 'john');
    t.strictEqual(foo.previous('firstName'), 'beau');
    foo.firstName = 'blah';
    t.strictEqual(foo.previous('firstName'), 'john');
    t.end();
});

test('should have data serialization methods', function (t) {
    var foo = new Foo({
        firstName: 'bob',
        lastName: 'tom',
        thing: 'abc'
    });

    t.deepEqual(foo.attributes, {
        firstName: 'bob',
        lastName: 'tom',
        thing: 'abc',
        myBool: false,
        active: true
    });
    t.deepEqual(foo.serialize(), {
        firstName: 'bob',
        lastName: 'tom',
        thing: 'abc',
        myBool: false
    });
    t.end();
});

test('serialize should not include session properties no matter how they\'re defined.', function (t) {
    var Foo = State.extend({
        props: {
            name: 'string'
        },
        session: {
            // simple definintion
            active: 'boolean'
        }
    });

    var Bar = State.extend({
        props: {
            name: 'string'
        },
        session: {
            // fuller definition
            active: ['boolean', true, false]
        }
    });

    var foo = new Foo({name: 'hi', active: true});
    var bar = new Bar({name: 'hi', active: true});
    t.deepEqual(foo.serialize(), {name: 'hi'});
    t.deepEqual(bar.serialize(), {name: 'hi'});
    t.end();
});

test('should fire events normally for properties defined on the fly', function (t) {
    var foo = new Foo();
    foo.extraProperties = 'allow';
    foo.on('change:crazyPerson', function () {
        t.ok(true);
    });
    foo.set({
        crazyPerson: true
    });
    t.end();
});

test('should fire event on derived properties, even if dependent on ad hoc prop.', function (t) {
    var Foo = State.extend({
        extraProperties: 'allow',
        derived: {
            isCrazy: {
                deps: ['crazyPerson'],
                fn: function () {
                    return !!this.crazyPerson;
                }
            }
        }
    });
    var foo = new Foo();
    foo.on('change:isCrazy', function () {
        t.ok(true);
    });
    foo.set({
        crazyPerson: true
    });
    t.end();
});

test('should fire general change event on single attribute', function (t) {
    var foo = new Foo({firstName: 'coffee'});
    foo.on('change', function () {
        t.ok(true);
    });
    foo.firstName = 'bob';
    t.end();
});

test('should fire single change event for multiple attribute set', function (t) {
    var foo = new Foo({firstName: 'coffee'});
    foo.on('change', function () {
        t.ok(true);
    });
    foo.set({
        firstName: 'roger',
        lastName: 'smells'
    });
    t.end();
});

test('derived properties', function (t) {
    var ran = 0;
    var notCachedRan = 0;
    var Foo = State.extend({
        props: {
            name: ['string', true]
        },
        derived: {
            greeting: {
                deps: ['name'],
                fn: function () {
                    ran++;
                    return 'hi, ' + this.name;
                }
            },
            notCached: {
                cache: false,
                deps: ['name'],
                fn: function () {
                    notCachedRan++;
                    return 'hi, ' + this.name;
                }
            }
        }
    });
    var foo = new Foo({name: 'henrik'});
    t.strictEqual(ran, 0, 'derived function should not have run yet.');
    t.equal(foo.greeting, 'hi, henrik');
    t.equal(foo.greeting, 'hi, henrik');
    t.equal(ran, 1, 'cached derived should only run once');
    t.equal(notCachedRan, 0, 'shold not have been run yet');
    foo.name = 'someone';
    t.equal(foo.greeting, 'hi, someone');
    t.equal(foo.greeting, 'hi, someone');
    t.equal(ran, 2, 'cached derived should have been cleared and run once again');
    t.equal(notCachedRan, 1, 'shold have been run once because it was triggered');
    t.equal(foo.notCached, 'hi, someone');
    t.equal(notCachedRan, 2, 'incremented again');
    t.equal(foo.notCached, 'hi, someone');
    t.equal(notCachedRan, 3, 'incremented each time');
    t.end();
});

test('cached, derived properties should only fire change event if they\'ve actually changed', function (t) {
    var changed = 0;
    var Foo = State.extend({
        props: {
            name: ['string', true],
            other: 'string'
        },
        derived: {
            greeting: {
                deps: ['name', 'other'],
                fn: function () {
                    return 'hi, ' + this.name;
                }
            }
        }
    });
    var foo = new Foo({name: 'henrik'});
    foo.on('change:greeting', function () {
        changed++;
    });
    t.equal(changed, 0);
    foo.name = 'new';
    t.equal(changed, 1);
    foo.other = 'new';
    t.equal(changed, 1);
    t.end();
});

test('derived properties with derived dependencies', function (t) {
    var ran = 0;
    var Foo = State.extend({
        props: {
            name: ['string', true]
        },
        derived: {
            greeting: {
                deps: ['name'],
                fn: function () {
                    return 'hi, ' + this.name;
                }
            },
            awesomeGreeting: {
                deps: ['greeting'],
                fn: function () {
                    return this.greeting + '!';
                }
            }
        }
    });
    var foo = new Foo({name: 'henrik'});
    foo.on('change:awesomeGreeting', function () {
        ran++;
        t.ok(true, 'should fire derived event');
    });
    foo.on('change:greeting', function () {
        ran++;
        t.ok(true, 'should fire derived event');
    });
    foo.on('change:name', function () {
        ran++;
        t.ok(true, 'should fire derived event');
    });
    foo.on('change', function () {
        ran++;
        t.ok(true, 'should file main event');
    });
    foo.name = 'something';
    t.equal(ran, 4);
    t.end();
});

test('derived properties triggered with multiple instances', function (t) {
    var foo = new Foo({firstName: 'Silly', lastName: 'Fool'});
    var bar = new Foo({firstName: 'Bar', lastName: 'Man'});

    foo.on('change:name', function () {
        t.ok('name changed');
    });
    foo.firstName = 'bob';
    bar.on('change:name', function () {
        t.ok('name changed');
    });
    bar.firstName = 'bob too';
    t.end();
});

test('should be able to bind events even if sealed', function (t) {
    var SealedModel = State.extend({seal: true, props: {name: 'string'}});

    var s = new SealedModel({name: 'henrik'});

    t.equal(s.name, 'henrik', 'should have set name');
    s.on('change:name', function () {
        t.ok(true, 'event was triggered.');
    });

    s.name = 'superman'; // ridiculous, right?
    t.end();
});

test('Calling `previous` during change of derived cached property should work', function (t) {
    var foo = new Foo({firstName: 'Henrik', lastName: 'Joreteg'});
    var ran = false;
    foo.on('change:name', function () {
        if (!ran) {
            t.equal(typeof foo.previous('name'), 'undefined');
            ran = true;
        } else {
            t.equal(foo.previous('name'), 'Crazy Joreteg');
        }
    });

    foo.firstName = 'Crazy';
    foo.firstName = 'Lance!';
    t.end();
});

test('Calling `previous` during change of derived property that is not cached, should be `undefined`', function (t) {
    var foo = new Foo({firstName: 'Henrik', lastName: 'Joreteg'});

    // the initials property is explicitly not cached
    // so you should not be able to get a previous value
    // for it.
    foo.on('change:initials', function () {
        t.equal(typeof foo.previous('initials'), 'undefined');
    });

    foo.firstName = 'Crazy';
    t.end();
});

test('Should be able to define and use custom data types', function (t) {
    var Foo = State.extend({
        props: {
            silliness: 'crazyType'
        },
        dataTypes: {
            crazyType: {
                set: function (newVal) {
                    return {
                        val: newVal,
                        type: 'crazyType'
                    };
                },
                get: function (val) {
                    return val + 'crazy!';
                }
            }
        }
    });

    var foo = new Foo({silliness: 'you '});

    t.equal(foo.silliness, 'you crazy!');
    t.end();
});

test('Uses dataType compare', function (t) {
    var compareRun;

    var Foo = State.extend({
        props: {
            silliness: 'crazyType'
        },
        dataTypes: {
            crazyType: {
                compare: function (oldVal, newVal) {
                    compareRun = true;
                    return false;
                },
                set: function (newVal) {
                    return {
                        val: newVal,
                        type: 'crazyType'
                    };
                },
                get: function (val) {
                    return val + 'crazy!';
                }
            }
        }
    });

    compareRun = false;
    var foo = new Foo({ silliness: 'you' });
    t.assert(compareRun);

    compareRun = false;
    foo.silliness = 'they';
    t.assert(compareRun);
    t.end();
});

test('Should only allow nulls where specified', function (t) {
    var foo = new Foo({
        firstName: 'bob',
        lastName: 'vila',
        someNumber: null
    });
    t.equal(foo.someNumber, null);
    t.throws(function () {
        foo.firstName = null;
    }, TypeError, 'Throws exception when setting unallowed null');
    t.end();
});

test('Attribute test function works', function (t) {
    var foo = new Foo({good: 'good'});
    t.equal(foo.good, 'good');

    t.throws(function () {
        foo.good = 'bad';
    }, TypeError, 'Throws exception on invalid attribute value');
    t.end();
});

test('Values attribute basic functionality', function (t) {
    var Model = State.extend({
        props: {
            state: {
                values: ['CA', 'WA', 'NV']
            }
        }
    });

    var m = new Model();

    t.throws(function () {
        m.state = 'PR';
    }, TypeError, 'Throws exception when setting something not in list');

    t.equal(m.state, undefined, 'Should be undefined if no default');

    m.state = 'CA';

    t.equal(m.state, 'CA', 'State should be set');
    t.end();
});

test('Values attribute default works', function (t) {
    var Model = State.extend({
        props: {
            state: {
                values: ['CA', 'WA', 'NV'],
                default: 'CA'
            }
        }
    });

    var m = new Model();

    t.equal(m.state, 'CA', 'Should have applied the default');

    t.throws(function () {
        m.state = 'PR';
    }, TypeError, 'Throws exception when setting something not in list');
    t.end();
});

test('toggle() works on boolean and values properties.', function (t) {
    var Model = State.extend({
        props: {
            isAwesome: 'boolean',
            someNumber: 'number',
            state: {
                values: ['CA', 'WA', 'NV'],
                default: 'CA'
            }
        }
    });

    var m = new Model();

    t.throws(function () {
        m.toggle('someNumber');
    }, TypeError, 'Throws exception when toggling a non-togglable property.');

    m.toggle('state');
    t.equal(m.state, 'WA', 'Should go to next');
    m.toggle('state');
    t.equal(m.state, 'NV', 'Should go to next');
    m.toggle('state');
    t.equal(m.state, 'CA', 'Should go to next with loop');

    m.toggle('isAwesome');
    t.strictEqual(m.isAwesome, true, 'Should toggle even if undefined');
    m.toggle('isAwesome');
    t.strictEqual(m.isAwesome, false, 'Should toggle if true.');
    m.toggle('isAwesome');
    t.strictEqual(m.isAwesome, true, 'Should toggle if false.');
    t.end();
});

test('property test function scope is correct.', function (t) {
    var m;
    var temp;
    var Model = State.extend({
        props: {
            truth: {
                type: 'boolean',
                test: function () {
                    temp = this;
                    return false;
                }
            }
        }
    });

    m = new Model();
    m.toggle('truth');
    t.equal(m, temp);
    t.end();
});

test('should be able to inherit for use in other objects', function (t) {
    var StateObj = State.extend({
        props: {
            name: 'string'
        }
    });
    function AwesomeThing() {
        StateObj.apply(this, arguments);
    }

    AwesomeThing.prototype = Object.create(StateObj.prototype, {
        constructor: AwesomeThing
    });

    AwesomeThing.prototype.hello = function () {
        return this.name;
    };

    var awe = new AwesomeThing({name: 'cool'});

    t.equal(awe.hello(), 'cool');
    t.equal(awe.name, 'cool');
    t.end();
});

test('extended state objects should maintain child collections of parents', function (t) {
    var State1 = State.extend({
        collections: {
            myStuff: Collection
        }
    });
    var State2 = State1.extend({
        collections: {
            myOtherCollection: Collection
        }
    });
    var thing = new State2();
    t.ok(thing.myStuff);
    t.ok(thing.myOtherCollection);
    t.end();
});

test('`initialize` should have access to initialized child collections', function (t) {
    var StateObj = State.extend({
        initialize: function () {
            t.ok(this.myStuff);
            t.equal(this.myStuff.parent, this);
            t.end();
        },
        collections: {
            myStuff: Collection
        }
    });
    var thing = new StateObj();
});

test('parent collection references should be maintained when adding/removing to a collection', function (t) {
    var StateObj = State.extend({
        id: 'string'
    });
    var c = new Collection();
    var s = new StateObj({id: '47'});
    c.add(s);
    t.equal(s.collection, c);
    c.remove(s);
    t.notOk(s.collection);
    t.end();
});
