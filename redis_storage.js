var redis = require('redis');

// handles all interaction with Redis
module.exports = function(config) {
    config = config || {};
    config.namespace = config.namespace || 'gomez-mix-aid:store';

    var client = redis.createClient(config);
    // below, all fields that are stored for any given card are defined
    var cardDataFields = [{
            name: 'id',
            type: 'string',
            indexed: false,
            notes: 'concatenation of season and card number, e.g. "S01-C001"',
        },
        {
            name: 'season',
            type: 'string',
            indexed: true,
            notes: 'e.g. "S01", "P01"',
        },
        {
            name: 'level',
            type: 'integer',
            indexed: true,
            notes: 'values range from 1-3',
        },
        {
            name: 'power',
            type: 'integer',
            indexed: true,
            notes: 'values range from 1-4',
        },
        {
            name: 'artist',
            type: 'string',
            indexed: true,
            notes: 'e.g. "Dolly Parton"',
        },
        {
            name: 'song',
            type: 'string',
            indexed: true,
            notes: 'e.g. "Jolene"',
        },
        {
            name: 'isYellow',
            type: 'boolean',
            indexed: true,
            notes: 'true if this card contains a yellow instrument part',
        },
        {
            name: 'yellowInstrument',
            type: 'string',
            indexed: true,
            commonIndex: 'instrument',
            notes: 'if this card has a yellow instrument part, this is its type (e.g. "Vocals")',
        },
        {
            name: 'isRed',
            type: 'boolean',
            indexed: true,
            notes: 'true if this card contains a red instrument part',
        },
        {
            name: 'redInstrument',
            type: 'string',
            indexed: true,
            commonIndex: 'instrument',
            notes: 'if this card has a red instrument part, this is its type (e.g. "Guitar")',
        },
        {
            name: 'isBlue',
            type: 'boolean',
            indexed: true,
            notes: 'true if this card contains a blue instrument part',
        },
        {
            name: 'blueInstrument',
            type: 'string',
            indexed: true,
            commonIndex: 'instrument',
            notes: 'if this card has a blue instrument part, this is its type (e.g. "Drums")',
        },
        {
            name: 'isGreen',
            type: 'boolean',
            indexed: true,
            notes: 'true if this card contains a green instrument part',
        },
        {
            name: 'greenInstrument',
            type: 'string',
            indexed: true,
            commonIndex: 'instrument',
            notes: 'if this card has a green instrument part, this is its type (e.g. "Keys")',
        },
        {
            name: 'isWhite',
            type: 'boolean',
            indexed: true,
            notes: 'true if this card is a white card (i.e. has no color)',
        },
        {
            name: 'isMulti',
            type: 'boolean',
            indexed: true,
            notes: 'true if this card has multiple colors',
        },
        {
            name: 'playlist',
            type: 'string',
            indexed: true,
            notes: 'e.g. "Moonlight"',
        },
        {
            name: 'playlistIndex',
            type: 'integer',
            indexed: false,
            notes: 'the index of the card in a particular set list, usually an integer ranging from 1-15',
        },
        {
            name: 'isFX',
            type: 'boolean',
            indexed: true,
            notes: 'true if this card has special FX rules when played',
        },
        {
            name: 'FXRuleText',
            type: 'string',
            indexed: false,
            notes: 'if this card has special FX rules when played, this is the description of those rules',
        },
        {
            name: 'artURL',
            type: 'string',
            indexed: false,
            notes: 'URL to the artwork for this card',
        },
        {
            name: 'artHash',
            type: 'string',
            indexed: false,
            notes: 'hash for accessing artwork for this card',
        },
        {
            name: 'cardHash',
            type: 'string',
            indexed: false,
            notes: 'unique card hash',
        },
    ];

    var storage = function() {

        return {
            getDataFields: function() {
                return cardDataFields;
            },
            // makeCardKey: helper function to generate Redis keys for getting your data
            makeCardKey: function(type, key) {
                return config.namespace + ':' + type + ':' + key;
            },
            // getCard: given a card ID, gets the associated data for that card
            getCard: function(cardId, cb) {
                var localThis = this;
                client.hgetall(localThis.makeCardKey('data', cardId), function(err, res) {
                    if (err) {
                        return cb(new Error(err), {});
                    } else {
                        var cardObject = res;
                        if (null != cardObject) {
                            for (var fieldIndex = 0; fieldIndex < cardDataFields.length; fieldIndex++) {
                                var field = cardDataFields[fieldIndex];
                                if (cardObject.hasOwnProperty(field.name)) {
                                    if (null !== cardObject[field.name]) {
                                        // validate data conforms to expectations
                                        if (field.type == 'boolean') {
                                            // standardize to true or false
                                            if (cardObject[field.name]) {
                                                cardObject[field.name] = true;
                                            } else {
                                                cardObject[field.name] = false;
                                            }
                                        } else if (field.type == 'integer') {
                                            if (isNaN(cardObject[field.name])) {
                                                // bad data, but just spit it out, do nothing here
                                            } else {
                                                cardObject[field.name] = parseInt(cardObject[field.name], 10);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        return cb(null, cardObject);
                    }
                });
            },
            // saveCard: main function for saving data for a particular card ID.
            // takes a cardObject
            saveCard: function(cardObject, cb) {
                var localThis = this;
                // this function supports saving any number of fields.  if it's in the object
                // it will be saved, if not in the object, it won't be touched.  if it's in the object
                // but is null, it will be cleared.
                if (!cardObject.id) {
                    return cb(new Error('a card ID is required'), {});
                } else {
                    localThis.getCard(cardObject.id, function(err, res) {
                        if (err) {
                            console.log(err);
                            return cb(new Error('Could not retrieve card ID ' + cardObject.id), {});
                        } else { //main save logic
                            if (null === res) {
                                // we are creating new card data for this ID
                                cardObject._newCard = true;
                            }
                            var oldData = res;
                            var hmsetArray = [];
                            var hdelArray = [];
                            var setsToPopulate = [];
                            var setsToRemove = [];
                            for (var fieldIndex = 0; fieldIndex < cardDataFields.length; fieldIndex++) {
                                var field = cardDataFields[fieldIndex];
                                if (cardObject.hasOwnProperty(field.name)) {
                                    // if the passed field exists but is null, 
                                    // we want to clear that field
                                    // otherwise, process as usual
                                    if (null !== cardObject[field.name]) {
                                        if (field.type == 'string') {
                                            // leave as-is
                                        }
                                        // validate data conforms to expectations
                                        else if (field.type == 'boolean') {
                                            // standardize to true or false
                                            if (cardObject[field.name]) {
                                                cardObject[field.name] = true;
                                            } else {
                                                cardObject[field.name] = false;
                                            }
                                        } else if (field.type == 'integer') {
                                            if (isNaN(cardObject[field.name])) {
                                                return cb(new Error(field.name + ' is not of type ' + field.type), {});
                                            } else {
                                                cardObject[field.name] = parseInt(cardObject[field.name], 10);
                                            }
                                        } else {
                                            return cb(new Error('Unknown field type: ' + field.type), {});
                                        }
                                    } else {
                                        // if we are creating a new card, we don't want nulls in the object at all (they serve no purpose)
                                        // and we don't need to bother trying to process it
                                        if (cardObject._newCard) {
                                            delete cardObject[field.name];
                                            continue;
                                        }
                                    }
                                    // only attempt to edit set data if something is changing (or is being populated)
                                    if (cardObject._newCard ||
                                        (!oldData.hasOwnProperty(field.name) ||
                                            (oldData.hasOwnProperty(field.name) && oldData[field.name] != cardObject[field.name]))) {
                                        if (null === cardObject[field.name]) {
                                            hdelArray.push(field.name); // if this was a new card, we have already removed nulls
                                        } else {
                                            hmsetArray.push(field.name, cardObject[field.name]);
                                        }
                                        if (field.indexed) {
                                            if (!cardObject._newCard &&
                                                oldData.hasOwnProperty(field.name) &&
                                                (null !== oldData[field.name] && "undefined" !== typeof oldData[field.name])) {
                                                setsToRemove.push({
                                                    key: localThis.makeCardKey('sets', field.name + ':' + oldData[field.name]),
                                                    value: cardObject.id,
                                                });
                                            }
                                            if (null !== cardObject[field.name] && "undefined" !== typeof cardObject[field.name]) {
                                                setsToPopulate.push({
                                                    key: localThis.makeCardKey('sets', field.name + ':' + cardObject[field.name]),
                                                    value: cardObject.id,
                                                });
                                                /* // may want to do this in the future, need to figure out how to efficiently clean up on delete
                                                setsToPopulate.push(
                                                    {
                                                	key: localThis.makeCardKey('sets', field.commonIndex || field.name),
                                                	value: cardObject[field.name],
                                                    }
                                                );
                                                */
                                            }
                                        }
                                    }
                                }
                            }
                            var multi = client.multi();
                            var multiCommonError = function(err, res) {
                                if (err) {
                                    console.log('MULTI COMMAND FAIL');
                                    console.log(err);
                                    multi.discard();
                                    return cb(new Error('Could not save card data!'), {});
                                }
                            };
                            if (hdelArray.length > 0) {
                                multi.hdel(localThis.makeCardKey('data', cardObject.id), hdelArray, multiCommonError);
                            }
                            if (hmsetArray.length > 0) {
                                multi.hmset(localThis.makeCardKey('data', cardObject.id), hmsetArray, multiCommonError);
                            }
                            for (var i = 0; i < setsToPopulate.length; i++) {
                                multi.sadd(setsToPopulate[i].key, setsToPopulate[i].value, multiCommonError);
                            }
                            for (var i = 0; i < setsToRemove.length; i++) {
                                multi.srem(setsToRemove[i].key, setsToRemove[i].value, multiCommonError);
                            }
                            multi.exec(); //error handling?
                            return cb(null, {});
                        }
                    });
                }
            },
            // deleteCard: main function for deleting cards
            // takes a cardObject
            deleteCard: function(cardObject, cb) {
                var localThis = this;
                localThis.getCard(cardObject.id, function(err, res) {
                    if (err) {
                        console.log(err);
                        return cb(new Error('Could not delete card data!'), {});
                    } else {
                        if (null === res) {
                            return cb(new Error('Card ID "' + cardObject.id + '" does not exist!'), {});
                        } else {
                            var cardToDelete = res;
                            var multi = client.multi();
                            var multiCommonError = function(err, res) {
                                if (err) {
                                    console.log(err);
                                    multi.discard();
                                    return cb(new Error('Could not delete card data!'), {});
                                }
                            };
                            multi.del(localThis.makeCardKey('data', cardToDelete.id), multiCommonError);
                            for (var fieldIndex = 0; fieldIndex < cardDataFields.length; fieldIndex++) {
                                var field = cardDataFields[fieldIndex];
                                if (field.indexed && cardToDelete[field.name]) {
                                    multi.srem(localThis.makeCardKey('sets', field.name + ':' + cardToDelete[field.name]), cardToDelete.id, multiCommonError);
                                }
                            }
                            multi.exec(); //error handling?
                            return cb(null, {});
                        }
                    }
                });
            },
            // getCardsFromIdList: given a list of cardIds, gets an array of cardObjects for you
            getCardsFromIdList: function(cardIds, cb) {
                var localThis = this;
                if (cardIds.length > 0) {
                    var script = "local res={}; for i, name in ipairs(KEYS) do local card = redis.call('hgetall','" + localThis.makeCardKey('data', '') + "'..name); table.insert(res, card); end return res;"
                        // current support for EVAL is pretty crap, have to use this syntax to get it to work
                    var args = [script, cardIds.length].concat(cardIds);
                    client.eval(args, function(err, res) {
                        if (err) {
                            console.log(err);
                            return cb(new Error('Could not get cards from eval!'), {});
                        } else {
                            // since we are using eval, we are getting back an array of arrays (of key value pairs)
                            // we want to convert to array of objects
                            var cardObjects = [];
                            for (var i = 0; i < res.length; i++) {
                                var cardArray = res[i];
                                var cardObject = {};
                                for (var j = 0; j < cardArray.length; j += 2) {
                                    cardObject[cardArray[j].toString('binary')] = cardArray[j + 1];
                                }
                                for (var fieldIndex = 0; fieldIndex < cardDataFields.length; fieldIndex++) {
                                    var field = cardDataFields[fieldIndex];
                                    if (cardObject.hasOwnProperty(field.name)) {
                                        if (null !== cardObject[field.name]) {
                                            // validate data conforms to expectations
                                            if (field.type == 'boolean') {
                                                // standardize to true or false
                                                if (cardObject[field.name]) {
                                                    cardObject[field.name] = true;
                                                } else {
                                                    cardObject[field.name] = false;
                                                }
                                            } else if (field.type == 'integer') {
                                                if (isNaN(cardObject[field.name])) {
                                                    // bad data, but just spit it out, do nothing here
                                                } else {
                                                    cardObject[field.name] = parseInt(cardObject[field.name], 10);
                                                }
                                            }
                                        }
                                    }
                                }
                                cardObjects.push(cardObject);
                            }
                            return cb(null, cardObjects);
                        }
                    });
                } else {
                    return cb(null, []);
                }
            },
            // getAllMatchingCardsBySetPairwiseMultipleAND: use this function to search for cards using multiple indexed fields
            // and search values.  the search parameters should be passed in as an array of objects where each object
            // has a 'key' and 'value' property.  search will be treated as an AND search (i.e. only cards that match
            // ALL parameters will be returned).
            // returns an array of cardObjects
            getAllMatchingCardsBySetPairwiseMultipleAND: function(searchParameters, cb) {
                var localThis = this;
                if (searchParameters && searchParameters.length > 0) {
                    var interKeys = [];
                    for (var i = 0; i < searchParameters.length; i++) {
                        var search = searchParameters[i];
                        if (search.hasOwnProperty('key') && null !== search.key &&
                            search.hasOwnProperty('value') && null !== search.value) {
                            interKeys.push(localThis.makeCardKey('sets', search.key + ':' + search.value));
                        }
                    }
                    if (interKeys.length > 0) {
                        client.sinter(interKeys, function(err, res) {
                            if (err) {
                                console.log(err);
                                return cb(new Error('Could not get set intersection!'), null);
                            } else {
                                return localThis.getCardsFromIdList(res, cb);
                            }
                        });
                    } else {
                        return cb(null, []);
                    }
                } else {
                    return cb(null, []);
                }
            },
            // getAllMatchingCardsBySetPairwiseMultipleOR: use this function to search for cards using multiple indexed fields
            // and search values.  the search parameters should be passed in as an array of objects where each object
            // has a 'key' and 'value' property.  search will be treated as an OR search (i.e. cards that match
            // ANY parameters will be returned).
            // returns an array of cardObjects
            getAllMatchingCardsBySetPairwiseMultipleOR: function(searchParameters, cb) {
                var localThis = this;
                if (searchParameters && searchParameters.length > 0) {
                    var unionKeys = [];
                    for (var i = 0; i < searchParameters.length; i++) {
                        var search = searchParameters[i];
                        if (search.hasOwnProperty('key') && null !== search.key &&
                            search.hasOwnProperty('value') && null !== search.value) {
                            unionKeys.push(localThis.makeCardKey('sets', search.key + ':' + search.value));
                        }
                    }
                    if (unionKeys.length > 0) {
                        client.sunion(unionKeys, function(err, res) {
                            if (err) {
                                console.log(err);
                                return cb(new Error('Could not get set union!'), null);
                            } else {
                                return localThis.getCardsFromIdList(res, cb);
                            }
                        });
                    } else {
                        return cb(null, []);
                    }
                } else {
                    return cb(null, []);
                }
            },
        };
    };
    return storage;
};