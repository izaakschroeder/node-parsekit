
var Grammar = require('./grammar.js');

function Parser(opts) {
	this.gotoTable = opts.gotoTable;
	this.actionTable = opts.actionTable;
	this.initialState = typeof opts.initialState === "object" ? opts.initialState.id : opts.initialState;
	this.productions = opts.productions.slice();
	this.reset();
}

Parser.prototype.reset = function() {
	var s = this.initialState;
	this.stack = [ { symbol: null, nextState: s } ];
}

Parser.prototype.feed = function(t) {
	var done = false, parser = this;
	
	do {
		
		var 
			top = parser.stack[parser.stack.length-1],
			lookahead = [ t ],
			actions = parser.actionTable[top.nextState][lookahead.join()];
		
		if (!actions)
			throw "Unexpected token lol";
		
		function takeAction(action) {
			
			if (typeof action.nextState !== "undefined") {
				//Shift the symbol on the stack
				parser.stack.push({ symbol: t, nextState: action.nextState});
				//TODO: Propagate the event
				done = true;
			}
			else if (typeof action.production !== "undefined") {
				var rhs = [ ];
				var production = parser.productions[action.production];
				for (var i = 0; i<production.rightHandSide.length; ++i) //Loop through the right hand side of the production
					rhs.unshift(parser.stack.pop().symbol); //Stack gets popped off in reverse, so fix it by inserting at the beginning all the time
				
				var top = parser.stack[parser.stack.length-1];
				var nextState = parser.gotoTable[top.nextState][production.leftHandSide];
								
				//In the accept state
				if (typeof nextState === "undefined" && top.nextState == parser.initialState) {
					done = true;
					return;
				}
				else if (nextState === null) {
					throw "Some part of the goto table is messed up!";
				}
				
				parser.stack.push({ symbol: production.leftHandSide, nextState: nextState}); //Push the next state onto the stack
				
				//TODO: Propagate the event
				
			}
			else {
				throw "Unknown action type lol!";
			}
		}	
		
		
		if (actions.length == 1) { //No ambiguity, just a nice, single action
			takeAction(actions[0]);
		}
		else if (actions.length > 1) { //There's more than one action for this input (some class of grammar beyond LR(1))
			//TODO: Split the stack for parallel evaluation
			//In the meantime, just bail
			console.log(actions);
			throw "Ambiguity dunno wat to do lol";
		}
		else { //There's a state without actions... something when seriously wrong when generating the grammar
			throw "State malformed lol u derp";
		}
	} while (!done);
}

Parser.prototype.endOfStream = function() {
	this.feed("$");
}

exports.create = function(opts) {
	return new Parser(opts);
}
