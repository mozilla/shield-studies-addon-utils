# Example Shield Study Addon.

## Features:

- a few variations
- some overriden functions

  - cleanup
  - isEligible


## install:

```npm install```

##run:

```
./node_modules/.bin/shield run .
```

at random

```
shield run  . --debug  -- -b Aurora
```

with a known variation
```
shield run  v3 --debug  -- -b Aurora
```

with ineligible
```
shield run v3 --prefs ineligible.json --debug -- -b Aurora
```
