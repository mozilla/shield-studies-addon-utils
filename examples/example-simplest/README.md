# Example Shield Study Addon.

## features

- 2 files, no real feature
- one variation, all defaults for everything

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
shield run  kittens --debug  -- -b Aurora
```

with ineligible
```
shield run kittens --prefs ineligible.json --debug -- -b Aurora
```
