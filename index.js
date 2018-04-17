require('dotenv').config();
const Redis_Storage = require('./redis_storage.js');
const Fs = require('fs');
const CSVParse = require('csv-parse');
const Express = require('express');
const App = Express();

// make sure all env vars are set
if (!process.env.REDIS_URL ||
    !process.env.PORT) {
    console.log('Error: [REDIS_URL, PORT] env vars must all be set!');
    process.exit(1);
}
// connect to Redis
var redis = new Redis_Storage({ url: process.env.REDIS_URL })();

// this routine controls how the CSV file gets loaded into the DB
// this should be updated whenever column-level changes to cardlist.csv occur
var loadparser = new CSVParse({ columns: true }, function(err, output) {
    if (err) {
        console.log('Error parsing file: ' + err);
    } else {
        for (var i = 0; i < output.length; i++) {
            var card = {};
            card.id = output[i].Season + '-' + output[i].CardNo;
            card.season = output[i].Season;
            card.level = output[i].Level;
            card.power = card.level; // default power to card level, this is overriden for wild and FX
            card.artist = output[i].Artist;
            card.song = output[i].Title;
            card.playlist = output[i].Playlist;
            card.artHash = output[i].ArtHash;
            card.cardHash = output[i].CardHash;
            if (output[i].Color == 'Wild') {
                var instruments = output[i].Instrument.split('|');
                if (instruments.length != 4) {
                    console.log("bad instrument value found on record " + i + ": " + output[i].Instrument);
                    continue;
                }
                card.isMulti = true;
                card.isYellow = true;
                card.yellowInstrument = instruments[0];
                card.isRed = true;
                card.redInstrument = instruments[1];
                card.isBlue = true;
                card.blueInstrument = instruments[2];
                card.isGreen = true;
                card.greenInstrument = instruments[3];
                card.power = 4; // override power to 4
            } else if (output[i].Color == 'Lead') {
                card.isYellow = true;
                card.yellowInstrument = output[i].Instrument;
            } else if (output[i].Color == 'Loop') {
                card.isRed = true;
                card.redInstrument = output[i].Instrument;
            } else if (output[i].Color == 'Beat') {
                card.isBlue = true;
                card.blueInstrument = output[i].Instrument;
            } else if (output[i].Color == 'Bass') {
                card.isGreen = true;
                card.greenInstrument = output[i].Instrument;
            } else if (output[i].Color == 'White') {
                card.isWhite = true;
                card.isFX = true;
                card.FXRuleText = output[i].Notes;
                card.power = 4; // override power to 4
            } else {
                console.log("bad color found on record " + i + ": " + output[i].Color);
                continue;
            }
            redis.saveCard(card, function(err, res) {
                if (err) {
                    console.log("error saving card, line " + i + ": " + err);
                }
            });
        }
    }
});

var cardSort = function(a, b) {
    return (a.id < b.id) ? -1 : ((a.id > b.id) ? 1 : 0);
};

// if you want to hook up a front-end server to this back-end server,
// set the FRONT_END_SERVER_URL to prevent CORS errors 
App.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", process.env.FRONT_END_SERVER_URL);
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// this will refresh/create card data on the DB
App.get('/load-data', function(req, res) {
    var input = Fs.createReadStream(__dirname + '/cardlist.csv');
    input.pipe(loadparser);
    res.send('loaded data');
});

App.get('/', function(req, res) {
    var query = req.query;
    var keys = Object.keys(query);
    if (!keys.length) {
        return res.json([]);
    }
    var searchParams = [];
    for (var i = 0; i < keys.length; i++) {
        // "connective" is a special key that determines whether all parameters
        // should attempt to create a union or intersection
        if (keys[i] == 'connective') {
            continue;
        }
        var values = query[keys[i]];
        if (typeof(values) == 'string') {
            searchParams.push({
                key: keys[i],
                value: values,
            });
        } else {
            for (var j = 0; j < values.length; j++) {
                searchParams.push({
                    key: keys[i],
                    value: values[j],
                });
            }
        }
    }
    if (query.connective == 'OR') {
        redis.getAllMatchingCardsBySetPairwiseMultipleOR(searchParams, function(err, data) {
            if (err) {
                console.log("Error getting card: " + err);
                res.status(500).send("Error getting card data!");
            } else {
                data.sort(cardSort);
                res.json(data);
            }
        });
    } else {
        redis.getAllMatchingCardsBySetPairwiseMultipleAND(searchParams, function(err, data) {
            if (err) {
                console.log("Error getting card: " + err);
                res.status(500).send("Error getting card data!");
            } else {
                data.sort(cardSort);
                res.json(data);
            }
        });
    }
});

App.listen(process.env.PORT, () => console.log('Gomez mix-aid back-end running on port ' + process.env.PORT));