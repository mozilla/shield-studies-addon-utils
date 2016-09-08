#  How To Shield Study

## Key Ideas - Knowing Answers Using Studies

-  :crystal_ball: Shield Studies are addons with instrumentation  to help you <a id='knowing-back'></a>[see the future](#knowing) and make decisions about features
- :bar_chart: Shield Studies compare user response to feature variations
- :seedling: This tutorial builds a study addon from the ground up
- :floppy_disk: See [full tutorial code below](#final-code)
- :bomb: [`shield`, the Shield Study CLI Tool](https://github.com/gregglind/shield-study-cli)
- :pencil: [Shield Studies Addon Template](https://github.com/gregglind/shield-studies-addon-template), includes common build, linting, and deploy machinery

## Example: Puppies Up In Your Browser :dog: :arrow_up: :computer:

[Fake!] VP of Firefox has a <a id='notsorry-back'></a><span id='notsorry-back'>[pet theory](#notsorry) that users love theming their browser with puppy images.

You want to please the VP of Firefox.

So, you build an addon to get some puppies up in yer browser.


1.  Install some needful tools.

	```shell
  # useful global cli tools
  npm install -g shield-study-cli jpm
  ```

2.  Start a project.

	**Low level (raw)**

   ```shell
   # a directory
	mkdir theme-shield-study && cd $_
	jpm init
	npm install --save-dev jpm
	touch {index,theme}.js
	```

	:gift: **Shield Bonus**: `shield init theme-shield-study && cd $_` when you need to do for real.

3.  Make the feature.

	**theme.js**

	```js
	/** theme.js **/
	exports.puppies = function applyPuppies () {
	  // implement puppy theme work
	  console.log("puppies");
	}
	```

	**index.js**

	```js
	/** index.js **/
	require("./theme").puppies();
	```

3.  Run the addon.

	```shell
	shield run . -- -b Aurora

	# calls out to `jpm` after setting up all the things
	```

:gift: **Shield Bonus**: :zzz: If you are already feeling impatient, [full code is below](#final-code) .

## Nagging Doubts? No! *Research Questions.*

The puppy themer addon is built.  The VP of Firefox loves it.  Tests pass and nothing crashes.  Time to land it!

*Or is it?*

:crying_cat_face: People keep asking inconvenient questions.

### Research Questions

Is it better?

1. For **Release** users, does theming lead to

  1. **better retention**
  2. **higher usage**
  3. **more statisfaction**

2. Do users want **puppies or kittens** more?


:gift: **Shield Bonus**:  You can answer all those questions using a **SHIELD STUDY**.

## Shield Studies Are Addons for Research

A Shield Study is an addon that some useful behaviours built-in to help answer research questions.

### How a Shield Study Answers Questions

- show feature (variations) to randomly-selected users
- for a while
- see what they do (behaviour)
- hear their opinions using surveys


`Science > Superstition`

## Dogs, Cats, or Nothing (Variations)

Together with the <a id='weird-science-back'></a>[Weird Science Team](#weird-science), you decide on 3 variations to try:

- :dog: puppies
- :cat: kittens
- :eyes: (no theme, observe only)

Let's expand the choice of themes.  Organize all the choices into a `variations` object of this form:

- keys are the variation names
- values are the functions to run (implement) the variations.

**theme.js**

```js
/** theme.js */

function theme (choice) {
  // do theme work
  console.log("theme is", choice);
}

exports.variations = {
  "notheme": () {},
  "puppies": () => theme("puppies"),
  "kittens": () => theme("kittens")
}
```

**index.js**

```js
/** index.js */

/* give a theme to the user */
require("./theme").puppies()
```

### More Themes Makes New Problems

:crying_cat_face: New problem: in the current `index.js`, all the users get the same theme &ndash; _puppies_.

Shield-studies are **single-blinded** experiments.  Ideally, we want a paricular user to be assigned one of the choices **at random**, with equal probabality.

Bad solution: We **could** write our own randomization function to tackle this.  *And* store the choice in a preference, so that the user **always** gets the same variation.

Better solution: use `shield-studies-addon-utils`, which handles these headaches &ndash; randomization, persistence (and more) &ndash; for you.

1.  Add `shield-studies-addon-utils` to the project.

	```shell
	npm install --save-dev shield-studies-addon-utils
	```

2.  Use `shield-studies-addon-utils` in the project code.

	**index.js**

	```js
	/** index.js */
	const self = require("sdk/self");

	const shield = require("shield-studies-addon-utils");
	const studyConfig = require("./theme");
	const thisStudy = new shield.Study(studyConfig);
	thisStudy.startup(self.loadReason);
	```

Now `thisStudy.startup` **decides** which branch the user receives, by setting these prefs (if unset):

  - `<addonId>.shield.variation` - which variation user will get
  - `<addonId>.shield.firstrun`  - epoch when study began

:gift: **Shield Bonus**: `Study` **re-uses** these choices during subsequent startups.

:gift: **Shield Bonus**: There are ways of specifying which variation the user gets for testing, using the `Study.decide` method.  Overriding this method can also do non-random or unequal assignment to `variation`.


### Pick a Theme, Any Theme

Use the `shield` cli command to run a particular variation for testing and demonstration purposes.


1. demo "kittens" variation on Aurora (Developer Edition)

	```
	$ shield . kittens  -- -b Aurora
	```

:gift: **Shield Bonus**: Arguments after the `--` are passed along to `jpm`.


### Housekeeping: Isolate the Study Code

I don't like tangling up my feature code with study code, so let's spread it out a bit more.

Let's generalize `theme.js => feature.js`.

While we are here, we give the study a `config.name`.

1.  Rename `theme.js` to `feature.js`, change the function names.

	**feature.js (`theme.js`)**

	```js
	/** feature.js **/

	function feature (choice) {
	  // do feature work
	  console.log("feature is", choice);
	}
	exports.feature = feature;
	```

2.  Add `config.name`, use `feature`.

	**study.js**

	```js
	/** study.js **/

	const self = require("sdk/self");
	const shield = require("shield-studies-addon-utils");

	const { feature } = require("./feature");

	const config = {
	  name: self.addonId,
	  variations = {
	    "notheme": () => feature("notheme"),
	    "puppies": () => feature("puppies"),
	    "kittens": () => feature("kittens")
	  }
	}

	const thisStudy = new shield.Study(studyConfig);

	exports.study = thisStudy;
	```

3. Use the `study` in `index.js`

	**index.js (final form)**

	```js
	/** index.js **/
   const self = require("sdk/self");
	require("./study").study.startup(self.loadReason);
	```

4.  Let's fancy up the study by subclassing `shield.Study`:


	**study.js**

	```js
	/** study.js **/
	const self = require("sdk/self");
	const shield = require("shield-studies-addon-utils");

	const { feature } = require("./feature");

	const studyConfig = {
		name: self.addonId,
	   variations: {
	      "notheme": () => feature("notheme"),
	      "puppies": () => feature("puppies"),
	      "kittens": () => feature("kittens")
	    }
	  }
	}

	class OurStudy extends shield.Study {
	  constructor (config) {
	    super(config);
	  }
	}

	const thisStudy = new OurStudy(studyConfig);

	exports.study = thisStudy;
	```

:gift: **Shield Bonus**: `shield.Study` has a lot of overridable methods.  [Full Shield.Study Api]()


## Telemetry For Free

By using a `shield.Study`, we get some Telemetry for free.

The `Study` sends [shield-study telemetry packets]() for these lifecycle events:

- `install`: once
- `startup`: every Firefox startup
- `shutdown`: every end of session
- `running`: once per day
- `end-of-study`:  study expires (is complete)
- `user-ended-study`:  user disabled or uninstalled
- `ineligible`:  user was not eligilbe

These data are enough to answer Research Questions 1.1, 1.2.

For Question 1.3 &ndash; _more satisfication_ &ndash; we need to _ask_ users about their perceptions.

## What does the user think?  Surveys

Configure `surveyUrls`, so we can ask questions to users about their experience.  Surveys can be called when the user experiences one of these 3 triggers:

- `user-ended-study`:  disable or uninstall
- `end-of-study`:  the study expired naturally
- `ineligible`:  user was ineligible

At these 3 times, the `study` will open a background tab to that survey url.  The `shield.survey` function appends a `reason` queryArg and some other fields to the `surveyUrl`.  One could use the same url for all 3.  If any of these 3 are `null`, the `survey` will NOT be opened at that time.

Get these urls and survey help from Firefox Strategy + Insights Team.

Add a `surveyUrls` object to `config`.

**study.js**

```js
const studyConfig = {
	name: self.addonId,
    surveyUrls:  {
        'end-of-study': 'some/url'
        'user-ended-study': 'some/url',
        'ineligible':  null
    },
    variations: {
		// ...
    }
}
```

:gift: **Shield Bonus**:  Lint `surveyUrls` with `Study.lint()` or the `shield` cli tool.


## Study Lifecycle

Our Study works&trade;, in that a user:

1. will be assigned to a variation
2. will get that same variation every restart
3. measures will be sent to Unified Telemetry for important study events
4. users will be asked perceptions about the feature experience, via surveys

For some studies, this is enough.

Other studies want a little more UI during the study life-cycle to handle orientation, cleanup, and ineligibility.  They may also want to add their own measures for feature-specific usage.

:crying_cat_face: Nobody wants to test that this UI works properly across restarts and under different study life-cycle conditions.

:gift: **Shield Bonus**:  handling life-cycle conditions is kind of the point of Shield :clap: :+1:

### Beginnings: Ineligible Users

While we are testing the addon internally, we realize that some users already have applied puppy (or other) themes.  We don't want to enroll these users, because their data doesn't apply to the feature rollout questions.

By default, if they are ineligible, the addon will silently uninstall.  We can augment that if we wish, by overriding the specially named `whenIneligible` function.

So, let's check if they are eligible, and handle them differently:

**feature.js**

```js
/** feature.js **/

const tabs = require('sdk/tabs');
const prefSvc = require("sdk/preferences/service");

// ...

exports.isEligible = function () {
  return !prefSvc.isSet('some.pref.somewhere');
}
```

**study.js**

```js
class OurStudy extends shield.Study {
  constructor (config) {
	// ...
  }
  isEligible () {
    // bool Already Has the feature.  Stops install if true
    return super.isEligible() && feature.isEligible()
  }
  whenIneligible () {
  	  super();
     // additional actions for 'user isn't eligible'
     tabs.open(`data:text/html,Uninstalling, you are not eligible for this study`)
  }
	// ...
}
```


### Beginnings: Orientation

It would be nice to explain to an enrolled user what the heck is going on, and how to turn this experiment off.

**feature.js**

```js
/** feature.js **/

const tabs = require('sdk/tabs');

// ...

exports.orientation = function orientation (choice) {
  return tabs.open(`data:text/html,You are on choice {choice}.  Stop by, use by etc`)
}

// ...
```

We have a special issue that the 'control' variation shouldn't have orientation.  Let's handle that better.


**study.js**

```js
/** study.js **/
class OurStudy extends shield.Study {
   // ...

	whenInstalled() {
     // orientation, unless our branch is 'notheme'
     if (this.variation == 'notheme') return;
     feature.orientation(this.variation);
	}
```

:gift: **Shield bonus**: the `Study.variation` property knows the user's assigned variation.


### All Good Things Must End

We need to tell `study.js` to handle endings (shutdown):

**study.js**

```js
const { when: unload } = require("sdk/system/unload");

//...
unload((reason) => thisStudy.shutdown(reason))
```

There are 3 possible endings

- natural study expiration (completion)
- user uninstall or disable
- user ineligible (never install), described previously.


#### Completing the Study (Natural Expiration)

Let's decide how long we want to collect data.  By default, it is 7 days.  After that period:

- the addon phones home as `end-of-study`
- a survey url opens (if provided) indicating `end-of-study`
- cleanup happens
- the study addon uninstalls

We decide to collect data for 14 days, to measure longer term retention and satisfaction.

**study.js**

```
const studyConfig = {
    name: self.addonId,
    days: 14,
    surveyUrls:  {
		// ...
    },
    variations: {
		// ...
    }
}
```

#### User Uninstalls or Disables

Shield Studies treat disable and uninstall as equivalent events for these reasons:

- (science):  Disable, then re-enable is an unclear statement of intent, and hard to interpret
- (technical):  The SDK has a hard time distinguishing them

During `uninstall` or `disable`:

- the addon phones home as `user-ended-study`
- a survey url opens (if provided) indicating `user-ended-study`
- cleanup happens
- the study addon uninstalls


:gift: **Shield Bonus**: when the user disables or uninstalls the Study addon, it phones home!  We can count that too, for each variation, to measure opt-out rate, by variation.


### Extra Measurements

You can add extra probes using `study.Report`.  Let's instrument that the users saw orientation.

**study.js**

```js
/** study.js **/
class OurStudy extends shield.Study {
   // ...

	whenInstalled() {
     // orientation, unless our branch is 'notheme'
     if (this.variation == 'notheme') return;
     this.report({
     	msg: "addon-orientation",
     	// ... other fields
     }
     feature.orientation(this.variation);
	}
```

This will report to Telemetry as:

```js

// usual telemetry environment is also included
// specific payload
{
	"msg": "addon-orientaton",
	// other fields
	// standard fields
	"study_branch": 'the variation',
	"study_name": 'the name'
	//...
}

```

:gift: **Shield Bonus**: You can call `shield.report` directly if needed.  `Study.report` is a static convenience method.


### Debugging and watching the Study in action

Add some listeners for telemetry and Study state changes.  This might help explain what `Shield` is doing, and convince you that it is doing it correctly.

**study.js**

```js
prefsSvc.set('shield.study.debug', true)
```

WOULD turn on debugging:

```js
shield.Reporter.on("report",(d)=>console.log("telemetry", d));
thisStudy.on("change",(newState)=>console.log("newState:", newState));
```

:gift: **Shield Bonus**: `shield run . --debug` does the same thing.

## Build, Lint, Deploy

**TODO**

- in progress cli tools
- in progress shield-study-addon-template

### shield-study-addon-template

1.  Check out [shield-studies-addon-template](https://github.com/gregglind/shield-studies-addon-template)

	```
	URL=https://github.com/gregglind/shield-studies-addon-template
	git clone --depth 1  $URL "your-addon_name" and && cd $_
	rm -rf .git
	git init
	# setup git stuff for your branch

	## get to work!
	```

	This is also `shield init my-project`, that does the same thing.

2.  Modify the things in these files

    - `lib/index.js`
    - `lib/study.js`
    - `lib/feature`
    - `package.json`

3.  fix tests
4.  profit.

### shield-studies-cli

0.  `npm install -g shield-studies-cli`
1.  use the `shield` cli tool

  - `shield run ./ some-variation`
  - `shield survey`


### Deploy

- host addon publically on amo
- needs an AMO static page
- needs all the bugs file [TODO]
- get a normany recipes

## Answer Your Research Questions

Contact your local data science wizard to get the data back from Unified Telemetry.  We will have a dashboard-feeding summarization job going Real Soon.

## Other magical magic

1.  Some useful prefs:

	- `shield.study.fakedie`: won't uninstall
	- `shield.study.debug`:   more debugging

2.  Every `Study` objects is an `EventTarget`.  You can listen / emit on it directly.

	```js
	aStudy.once('installed', function onceInstalled () {})
	```

3.  Choosing a variation for a demo or QA run.

	`shield . variationName`

4.  Unequal (or complex) assignment variations

	Override `decideVariation`.

	```js
	unequalVariations (study, rng=Math.random()) {
		// always return an rng
		if (rng < .3) {
			return 'a';
		elif (rng < .9) {
			return 'b';
		} else {
			return 'c'
		}
	}

	class UnequalAssigment extends shield.Study {
		// only used during first `install`
		decideVariation () {
			return unequalVariations(this)
		}
	}
	```

## Full Study Api

### Useful Overridable Methods in `Study`

- `cleanup`: what happens during uninstall (any reason).
- `decideVariation`: choose which variation user gets on install.
- `isEligible`: boolean for 'should study even install?'
- `showSurvey`: how to show surveys, append on query args, etc.
- `surveyQueryArgs`: what queryArgs to append onto surveys.
- `whenIneligible`: if user is NOT eligible, should we do anything, like explain why, or inform them?
- `whenInstalled`: after successful install, now what?  Orientation?
- `whenComplete`: when study completes (expires naturally), should anything unusual happen?

See the [source code](https://github.com/mozilla/shield-studies-addon-utils/blob/master/lib/index.js) for more details.

### Listenable signals

One can also listen directly on a running study for signals.

See the [source code](https://github.com/mozilla/shield-studies-addon-utils/blob/master/lib/index.js) for more details.



## Final Code

### feature.js
```js
/** feature.js **/

const tabs = require('sdk/tabs');
const prefSvc = require("sdk/preferences/service");

exports.which = function whichFeature (choice) {
  // do feature work
  console.log("feature is", choice);
}

exports.orientation = function orientation (choice) {
  return tabs.open(`data:text/html,You are on choice {choice}.  Stop by, use by etc`)
}

exports.isEligible = function () {
  return !prefSvc.isSet('some.pref.somewhere');
}
```
### index.js
```js
/** index.js **/
const self = require("sdk/self");
require("./study").study.startup(self.loadReason);

```

### study.js
```js
/** study.js **/
const self = require("sdk/self");
const shield = require("shield-studies-addon-utils");
const tabs = require('sdk/tabs');
const { when: unload } = require("sdk/system/unload");

const feature = require("./feature");

const studyConfig = {
  name: self.addonId,
  duration: 14,
  surveyUrls:  {
      'end-of-study': 'some/url',
      'user-ended-study': 'some/url',
      'ineligible':  null
  },
  variations: {
    "notheme": () => feature.which("notheme"),
    "puppies": () => feature.which("puppies"),
    "kittens": () => feature.which("kittens")
  }
}

class OurStudy extends shield.Study {
  constructor (config) {
    super(config);
  }
  isEligible () {
    // bool Already Has the feature.  Stops install if true
    return super.isEligible() && feature.isEligible()
  }
  whenIneligible () {
    super.whenIneligible();
    // additional actions for 'user isn't eligible'
    tabs.open(`data:text/html,Uninstalling, you are not eligible for this study`)
  }
  whenInstalled () {
    super.whenInstalled();
    // orientation, unless our branch is 'notheme'
    if (this.variation == 'notheme') {}
    feature.orientation(this.variation);
  }
  cleanup (reason) {
    super.cleanup();  // cleanup simple-prefs, simple-storage
    // do things, maybe depending on reason, branch
  }
  whenComplete () {
    // when the study is naturally complete after this.days
    super.whenComplete();  // calls survey, uninstalls
  }
  whenUninstalled () {
    // user uninstall
    super.whenUninstalled();
  }
  decideVariation () {
    return super.decideVariation() // chooses at random
    // unequal or non random allocation for example
  }
}

const thisStudy = new OurStudy(studyConfig);

// for testing / linting
exports.OurStudy = OurStudy;
exports.studyConfig = studyConfig;

// for use by index.js
exports.study = thisStudy;

unload((reason) => thisStudy.shutdown(reason))


```

## Enjoy Kittens and Puppies

Example Studies:

- [kittens and puppies example](https://github.com/mozilla/shield-studies-addon-utils/blob/master/examples/example-theme-study)
- [simpler pref-flipping study](https://github.com/mozilla/shield-studies-addon-utils/blob/master/examples/example-pref-flip)


## Author

Gregg Lind

Core tutorial format idea: @Osmose.

Readers / feedback / wit:

- Cathy Beil
- @Osmose (Michael Kelly)
- @raymak (Kamyar Ardekani


## Endnotes

1. <a name="knowing"></a> Insert a long, long digression about epistimology, the nature of knowledge, and statistic methods, perhaps summarized as:

	"By looking at a sample of people like the ones who will use the feature, we can infer what is *likely* to happen if deploy it for real."

	For this to be true we need:

   1. **random sample** ascertiained (enrolled) at random
   2. **from similar popuation** a population "alike-enough" to the "real" popuation
   3. **sample size** of a large enough size such that observed effects are likely to not be due to chance
   4. **fidelity of experience** measured using an experience that is "close enough" to how it will be "for real"
   5. **detectable effect** *but* where the variations are *different enough* to be different from each other and from a control (observe-only) experience &ndash; the effect size must be big enough to observe
   6. **blinded, random assignment** where each user is *assigned at random* (and blinded to which variation they received)
   7. **control group** with a control group to see "normal usage"


	The more our experiment differs from these assumptions, the less well it predicts the future.

	Much of the Shield Studies future work is about improving the fidelity of the sample to (real) Release users, and fixing things like:

	- Ascertainment bias (recruitment issues)
	- blinding


    <a href="#knowing-back">⇧</a>


2. <a name="notsorry"></a> Sorry, not sorry. <a href="#notsorry-back">⇧</a>

3. <a name="weird-science"></a> The Firefox Strategy + Insights "Weird Science" Subteam - Gregg Lind and friends.  <a href="#weird-science-back">⇧</a>


