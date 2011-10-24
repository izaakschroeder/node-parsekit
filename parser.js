
var 
	util = require('util'), 
	EventEmitter = require('events').EventEmitter;


var emit = function(type, args, context) {
	var type = arguments[0];
	// If there is no 'error' event listener then throw.
	if (type === 'error') 
		return EventEmitter.prototype.emit.call(this, type)

	if (!this._events) 
		return false;
	var handler = this._events[type];
	if (!handler) 
		return false;
	
	context = context || this;	
	
	if (typeof handler == 'function') {
		handler.apply(context, args);
		return true;
	} 
	else if (isArray(handler)) {
		for (var i = 0, l = handler.length; i < l; i++) {
			handler[i].apply(context, args);
		}
		return true;	
	} 
	else {
		return false;
	}
}









function Parser(opts) {
	EventEmitter.call(this);
	this.gotoTable = opts.gotoTable;
	this.actionTable = opts.actionTable;
	this.initialState = typeof opts.initialState === "object" ? opts.initialState.id : opts.initialState;
	this.productions = opts.productions.slice();
	this.productionMap = opts.productionMap;
	this.reset();
}
util.inherits(Parser, EventEmitter);

Parser.prototype.reset = function() {
	var s = this.initialState;
	this.stack = [ { symbol: null, nextState: s } ];
}

Parser.prototype.expects = function() {
	var expects = [ ];
	for (var lookahead in this.actionTable[this.stack[this.stack.length-1].nextState])
		expects.push(lookahead.split()[0]);
	return expects;
}

Parser.prototype.write = function(input) {
	var done = false, parser = this;
	
	if (typeof input === "object")
		token = input.token;
	else
		token = input;
	
	do {
		
		var 
			top = parser.stack[parser.stack.length-1],
			lookahead = [ token ],
			actions = parser.actionTable[top.nextState][lookahead.join()];
					
		if (!actions) {
			parser.emit("error", "Unexpected token ("+token+")"+util.inspect(parser.actionTable[top.nextState]));
			return
		}
		
		function takeAction(action) {
			
			if (typeof action.nextState !== "undefined") {
				//Shift the symbol on the stack
				parser.stack.push({ input: input, symbol: token, nextState: action.nextState });
				//Propagate the event
				parser.emit("shift", input)
				done = true;
			}
			else if (typeof action.production !== "undefined") {
				var rhs = [ ];
				var production = parser.productions[action.production];
				for (var i = 0; i<production.rightHandSide.length; ++i) { //Loop through the right hand side of the production
					var 
						top = parser.stack.pop(),
						item = top.input;
					item.parent = rhs;
					item.symbol = top.symbol;
					rhs.unshift(item); //Stack gets popped off in reverse, so fix it by inserting at the beginning all the time
				}
				
				var top = parser.stack[parser.stack.length-1];
				var nextState = parser.gotoTable[top.nextState][production.leftHandSide];
				
				
				rhs.production = production;

				//In the accept state
				if (typeof nextState === "undefined" && top.nextState == parser.initialState) {
					done = true;
					rhs.symbol = "_start";
					emit.call(parser, "end", rhs, parser);
					return;
				}
				else if (nextState === null) {
					throw "Some part of the goto table is messed up!";
				}
				
				parser.stack.push({ input: rhs, symbol: production.leftHandSide, nextState: nextState}); //Push the next state onto the stack
				
				//Propagate the event
				parser.emit("reduce", rhs, production);
				emit.call(parser, production.name, rhs, rhs);
				
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

Parser.prototype.end = function() {
	this.write("$");
}

Parser.create = function(opts) {
	return new Parser(opts);
}

module.exports = Parser;

