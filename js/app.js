/* ----- Begin Rollbar integration for Ember ----- */

// Helper we will use for Ember.onerror and Ember.RSVP.on
var _reportEmberErrorToRollbar = function(error, source) {
  if (error instanceof Error) {
    Rollbar.error(error, {emberSource: source + ' with error object'});
  } else {
    if (error.message && error.name) {
      Rollbar.error(error.name + ': ' + error.message,
        {origError: error, emberSource: source + ' with non-error instance'});
    } else {
      Rollbar.error(error, {emberSource: source + ' default'});
    }
  }
}

// Capture regular ember errors
Ember.onerror = function(error) {
  _reportEmberErrorToRollbar(error, 'Ember.onerror');
}

// Capture errors in promises.
// They will bubble up to onerror if we don't provide this, but when they bubble
// they lose stack information. With this, we get the stack.
Ember.RSVP.on('error', function(error) {
  _reportEmberErrorToRollbar(error, 'Ember.RSVP.on.error');
});

// This method appears to be necessary for capturing errors that happen in
// Ember.Route.extend.model
var _origEmberLoggerError = Ember.Logger.error;
Ember.Logger.error = function(initialMessage, errorMessage, errorStack, errorString) {
  // Call the orig function first
  _origEmberLoggerError(initialMessage, errorMessage, errorStack, errorString);

  // Now report to Rollbar.

  // Ember makes this complicated for us...
  // Ember.Logger.error is only called from one place (that I can find):
  // https://github.com/emberjs/ember.js/blob/5fe2d63a7dab0484cad9e729886ac71b4c05f1fd/packages/ember-routing/lib/system/router.js#L663
  // There can be several combinations of the above arguments, since each can be missing.
  // Since we can't tell for sure which one it is, let's just start with a version that will be useful:
  //
  // - use errorMessage as the message (it's the message of the inner error)
  // - use errorStack as the stack trace (it's the stack of the inner error)
  //
  // Also pass the args along as data in raw form, just in case it's helpful later.
  
  var data = {
    initialMessage: initialMessage,
    errorMessage: errorMessage,
    errorStack: errorStack,
    errorString: errorString
  }
  
  if (errorStack) {
    // We have a stack - report as an error object (we'll get a structured stack trace in Rollbar)
    var err = new Error();
    err.message = errorMessage;
    err.stack = errorStack;
    data.emberSource = 'Ember.Logger.error - with stack';
    Rollbar.error(err, data);
  } else {
    // No stack - just use the error message.
    data.emberSource = 'Ember.Logger.error - without stack';
    Rollbar.error(errorMessage, data);
  }
}

/* ----- End Rollbar integration ----- */



/* ----- Simple app code below ----- */

App = Ember.Application.create();

App.Router.map(function() {
  // Uncomment this to cause an an uncaught error, as well as an error that go through Ember.RSVP
  // to hit our Ember.RSVP.on('error') handler and a third error that will hit Ember.onerror:
  
  //throw new Error("error from App.Router.map");
  
  // Uncomment this to cause an normal uncaught js error, which will hit the window.onerror handler:
  
  //var foo = bar;
});

App.IndexRoute = Ember.Route.extend({
  model: function() {
    // Uncomment this to cause an error that will go through Ember.Logger.error:
    
    //throw new Error("error from Ember.Route.extend");

    return ['red', 'yellow', 'blue'];
  }
});
