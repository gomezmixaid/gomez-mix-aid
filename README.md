# gomez-mix-aid
A simple back-end for search DropMix card data via HTTP

Gomez mix-aid is a Redis-backed lightweight card DB intended for quickly finding cards that match specific criteria.  It can be queried via HTTP and returns JSON responses.

## Parameter Documentation
Gomez mix-aid supports the following parameters, which can be passed on the query string:
- season (string): return cards that are in the specified season ('S01', 'P01', etc)
- level (integer): return cards that match the specified level (i.e. a value from 1-3)
- power (integer): return cards that match the specified power as defined in deck-building rules (i.e. a value from 1-4)
- artist (string): return cards that match the specified artist.  Must exactly match value from DB (e.g. 'Dolly Parton').
- song (string): return cards that match the specified song.  Must exactly match value from DB (e.g. 'Jolene').
- isYellow (boolean): return cards that have a yellow instrument.
- isRed (boolean): return cards that have a red instrument.
- isBlue (boolean): return cards that have a blue instrument.
- isGreen (boolean): return cards that have a green instrument.
- isMulti (boolean): return cards that have multiple colored instruments.
- isWhite (boolean): return cards that have no color.
- isFX (boolean): return cards that have an special FX action.
- yellowInstrument (string): return cards that have the specified instrument in the yellow position.  Must exactly match value from DB (current instruments are Drums,Guitar,Horns,Keys,Sampler,Strings,Vocals)
- redInstrument (string): return cards that have the specified instrument in the red position.  Must exactly match value from DB (current instruments are Drums,Guitar,Horns,Keys,Sampler,Strings,Vocals)
- blueInstrument (string): return cards that have the specified instrument in the blue position.  Must exactly match value from DB (current instruments are Drums,Guitar,Horns,Keys,Sampler,Strings,Vocals)
- greenInstrument (string): return cards that have the specified instrument in the green position.  Must exactly match value from DB (current instruments are Drums,Guitar,Horns,Keys,Sampler,Strings,Vocals)
- playlist (string): return cards that are in the specified playlist.  Must exactly match value from DB (e.g. 'Mirrors')
- connective (string): value passed should be either 'AND' or 'OR'.  Specifies whether to return cards that match all specified parameters (AND) or any specified parameters (OR).  If not passed, behavior defaults to AND.

## Usage

Get all cards from the Mirrors playlist:
```
gomez-mix-aid/?playlist=Mirrors
```

Get all cards that are Green and level 2:
```
gomez-mix-aid/?isGreen=true&level=2
```

Get all yellow, red, and green Horns cards:
```
gomez-mix-aid/?greenInstrument=Horns&yellowInstrument=Horns&redInstrument=Horns&connective=OR
```

Get cards that are from Astro OR Lucky:
```
gomez-mix-aid/?playlist=Astro&playlist=Lucky&connective=OR
```

Note, be sure to use `connective=OR` properly.  If excluded from the above example, you would not get any results, because there are no cards that are both in Mirrors AND in Lucky (because a card cannot belong to two playlists).  However, if included in the `isGreen=true&level=2` example, it would produce cards that were green OR were level 2 (returning green level 3 cards and red level 2 cards, for example, which might not be what you wanted).