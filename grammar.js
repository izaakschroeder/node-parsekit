
var Parser = require('./parser');

/**
 *
 *
 *
 */
function Grammar(opts) {
	this.productions = [ ];
	this.tokens = { "$": true, "_epsilon": true  };
	this.nonTerminals = { "_start": true };
	this.firstSets = { };
	this.internalStartSymbol = "_start";
	this.productionMap = { }
	
	opts = opts || { };
	
	for (var i in opts.tokens) 
		this.token(Array.isArray(opts.tokens) ? opts.tokens[i] : i);
		
	for (var nonTerminal in opts.rules)
		this.nonTerminal(nonTerminal);
	
	for (var nonTerminal in opts.rules) {
		if (Array.isArray(opts.rules[nonTerminal])) {
			opts.rules[nonTerminal].forEach(function(rightHandSide) {
				this.production(nonTerminal, rightHandSide);
			})
		} 
		else if (typeof opts.rules[nonTerminal] === "object") {
			for (var name in opts.rules[nonTerminal]) {
				if (Array.isArray(opts.rules[nonTerminal][name])) {
					var rightHandSide = opts.rules[nonTerminal][name];
					this.production(nonTerminal, rightHandSide);
				}
				else if (typeof opts.rules[nonTerminal][name] === "object") {
					var object = opts.rules[nonTerminal][name];
					if (!object.rule)
						throw "WTF?"
					var production = this.production(nonTerminal, object.rule);
					production.name = name;
					this.productionMap[name] = production.id;
					for (var property in object) {
						if (property !== "rule")
							production[property] = object[property];
					}
				}
				else {
					throw "WTF?";
				}
			}
		}
		else {
			throw "WTF?"
		}
			
	}
		
	this.setStartSymbol(opts.start);
	this.generateFirstSets();	
	this.generateStates();
	this.generateTables();
	
	var d = require('./precedence');
	var x = new d();
	x.postProcess(this);
	
}

Grammar.epsilon = "_epsilon";
Grammar.endOfInput = "$";

/**
 *
 *
 *
 */
Grammar.prototype.firstSet = function(rhs) {
	rhs = Array.isArray(rhs) ? rhs : [rhs];
	
	if (rhs.length === 0)
		return { };
	
	var symbol = rhs[0];
	var firstSet = this.firstSets[symbol];
	

	if (!(Grammar.epsilon in firstSet) || symbol == Grammar.epsilon)
		return firstSet;
	
	var nextFirstSet = { };
	
	for (var symbol in firstSet) 
		if (symbol != Grammar.epsilon)
			nextFirstSet[symbol] = true;

	for (var symbol in this.firstSet(rhs.slice(1)))
		nextFirstSet[symbol] = true;
	
	if (!nextFirstSet)
		return nextFirstSet;	
	
	for (var symbol in nextFirstSet) 
		if (!(Grammar.epsilon in this.firstSets[symbol]))
			return nextFirstSet;
	
	nextFirstSet[Grammar.epsilon] = true;
	return nextFirstSet;
}

/**
 *
 *
 *
 */
Grammar.prototype.generateFirstSets = function() {
		
	this.firstSets = { };
	
	//First set of a terminal is just itself
	for (var t in this.tokens) {
		this.firstSets[t] = { };
		this.firstSets[t][t] = true;
	}
	
	//Clear first sets for non-terminals
	for(var n in this.nonTerminals) 
		this.firstSets[n] = { };
	
	var changed;
	do {
		changed = false;
		this.productions.forEach(function(production) {
			var firstSet = this.firstSets[production.leftHandSide];
			for (var symbol in this.firstSet(production.rightHandSide)) {
				if (!(symbol in firstSet)) {
					firstSet[symbol] = true
					changed = true;
				}
			};
		}, this); 
	} while(changed);
}

/**
 *
 *
 *
 */
Grammar.prototype.itemSetClosure = function(state) {
	var grammar = this;
	var workQueue = state.slice();
	var newItem;
	while (workQueue.length > 0) {
		var item = workQueue.shift();
		var dotPosition = item.dotPosition;
		var rightHandSide = item.production.rightHandSide;
				
		if (dotPosition < rightHandSide.length && rightHandSide[dotPosition] in this.nonTerminals) {

			var nonTerminal = rightHandSide[dotPosition];
			var tmp = rightHandSide.slice(dotPosition+1).concat(item.lookahead);
						
			this.productions.forEach(function(production) {
				
				if (production.leftHandSide != nonTerminal)
					return;
				
				var firstSet = grammar.firstSet(tmp);
								
				for (symbol in firstSet) 
					if (newItem = state.push(new Item(production, 0, [ symbol ], false))) 
						workQueue.push(newItem);
			})			
		}
	}
}

/**
 *
 *
 *
 */
Grammar.prototype.setStartSymbol = function(symbol) {
	if (!(symbol in this.nonTerminals))
		throw "Start symbol must be a non-terminal!";
	this.startSymbol = symbol;
	this.startProduction = this.production(this.internalStartSymbol, this.startSymbol);
	
}

/**
 *
 *
 *
 */
Grammar.prototype.generateStates = function() {
	
	
	
	this.initialState = new ItemSet();
	this.initialState.push(new Item(this.startProduction, 0, [ Grammar.endOfInput ], true));
	
	var 
		toDoList = [ this.initialState ],
		incompleteList = [ ],
		doneList = [ ],
		currentSet = null, comeFrom = null,
		setCount = 0;
	
	
	while (incompleteList.length > 0 || toDoList.length > 0) {		
		if (incompleteList.length > 0) {
			currentSet = incompleteList.pop();
			comeFrom = currentSet;
			currentSet.forEach(function(item){
				if (item.isShift() && !item.action) {
					var symbol = item.getMarkedSymbol();
					
					var newItemSet = new ItemSet();
					newItemSet.id = -1;
					toDoList.push(newItemSet);
					currentSet.forEach(function(shItem) {
						if (!shItem.isShift())
							return;
						var shS = shItem.getMarkedSymbol();
						if (shS == symbol) {
							newItemSet.push(new Item(shItem.production, shItem.dotPosition+1, shItem.lookahead, true));
							shItem.action = new Shift(symbol, item, newItemSet);
						}
					})

				}
			})

			currentSet.isComplete = true;
			doneList.push(currentSet);
		}
		
		while (toDoList.length > 0) {
			currentSet = toDoList.pop();
			this.itemSetClosure(currentSet);
			
			currentSet.forEach(function(item) {
				if (item.isReduction())
					item.action = new Reduce(item.production, item.lookahead);
			});
						
			function mergeBlock(toProcess) {
				
				for (var i = 0; i < toProcess.length; ++i) {
					
					var itemSet = toProcess[i];
					
					if (!itemSet.isWeaklyCompatibleWith(currentSet))
						continue;
					
					var reduceReduceConflict = itemSet.some(function(i){ return currentSet.some(function(j){ return i.hasReductionConflictWith(j); }); });
	
					
					if (!reduceReduceConflict) {
						var o = itemSet.length;
						var addedItems = itemSet.merge(currentSet);						
						comeFrom.forEach(function(item){
							if ((item.action instanceof Shift) && (item.action.nextState == currentSet))
								item.action.nextState = itemSet;
						})
						
						
						
						if (itemSet.isComplete && addedItems.some(function(item){ return item.isShift(); })) {
							itemSet.forEach(function(item) {
								if ((item.action instanceof Shift) && (item.action.nextState == currentSet))
									item.action = null;
							})
	
							itemSet.isComplete = false;
							doneList.splice(doneList.indexOf(itemSet), 1);
							incompleteList.push(itemSet);
						}
						
						currentSet = null;
						break;
					} 
					else {
						//Grammar is LR, not LALR
						//throw new Exception("Grammar contains ambiguities! This parser can't handle them yet!");
					}
				}				
			}
					
			mergeBlock(doneList);
			if (null != currentSet) 
				mergeBlock(incompleteList);
			
			if (currentSet != null) {
				currentSet.id = setCount++;
				incompleteList.push(currentSet);
			}
		}
	}
	
	this.states = doneList;
}

/**
 *
 *
 *
 */
Grammar.prototype.generateTables = function() {
	actionTable = [ ];
	gotoTable = [ ];
	var grammar = this;
	
	this.states.forEach(function(state){
		actionTable[state.id] = { };
		gotoTable[state.id] = { };
		
		function addAction(lookahead, action) {
			var key = lookahead.join();
			if (!actionTable[state.id][key])
				actionTable[state.id][key] = [ ];
			
				
			if (!actionTable[state.id][key].some(function( existingAction ){
				var 
					existingProperties = Object.getOwnPropertyNames( existingAction ),
					properties = Object.getOwnPropertyNames( action );
					
					if (existingProperties.length != properties.length)
						return false;
						
					existingProperties.sort();
					properties.sort();
					
					for (var i = 0; i < properties.length; ++i) {
						if (properties[i] != existingProperties[i])
							return false;
						if (action[properties[i]] != existingAction[properties[i]])
							return false;
					}
					
					return true;
					
			}))
				actionTable[state.id][key].push(action);
		}
		
		state.forEach(function(item){
			if (item.action instanceof Shift) { //Shift action
				var lookahead;
				
				if (item.action.shiftSymbol in grammar.tokens) { //The shifted symbol is a token
					addAction([ item.action.shiftSymbol ], { 
						nextState: item.action.nextState.id, 
						production: grammar.productions.indexOf(item.action.shiftItem.production) 
					})
				}
				else if (item.action.shiftSymbol in grammar.nonTerminals) { //The shifted symbol is a non-terminal
					var current = gotoTable[state.id][item.action.shiftSymbol];
					if (current === undefined) //We haven't marked this symbol in the goto table before
						gotoTable[state.id][item.action.shiftSymbol] = item.action.nextState.id; //Mark it
					else if (current !== item.action.nextState.id) //This symbol has already been placed into the goto table
						throw "Goto table mismatch! ("+current+" vs "+item.action.nextState.id+")"; //Something fishy is going on here
				} 
				else { //Not a token.. not a non-terminal.. what else could it be?
					throw "WTF?";
				}
			}
			else if (item.action instanceof Reduce) { //Reduce action
				addAction(item.action.lookahead, { 
					production: grammar.productions.indexOf(item.action.production) 
				});
			}
			else { //Some other unknown action
				//throw "Unknown action: "+item.action;
			}
		})
	})
	
	this.actionTable = actionTable;
	this.gotoTable = gotoTable;
}

/**
 *
 *
 *
 */
Grammar.prototype.removeEpsilonProductions = function() {
	
	var 
		more = false,
		grammar = this;
	
	
	do {
		var leftHandSides = { };
		
		more = false;
		
		this.productions.forEach(function(production, i, productions) {
			if (production.rightHandSide.indexOf(Grammar.epsilon) !== -1) { //1. Pick nonterminal A with epsilon production
				more = true;
				leftHandSides[production.leftHandSide] = true;
				productions.splice(i, 1); //2. Remove that epsilon production
				delete productions[production.key()];
			}
		})
		

		
		//3. For each production containing A: Replicate it 2^k times where k is the 
		//number of A instances in the production, such that all combinations of A 
		//being there or not will be represented.
		this.productions.forEach(function(production) {
						
			//Mark the nodes
			var 
				truthCount = 0,
				last = production.rightHandSide.map(function(symbol) { var t = symbol in leftHandSides; if (t) ++truthCount; return t; });
			
			if (truthCount === 0)
				return;
			
				
			function addProduction() {
				var newProduction = new Production(production.leftHandSide, production.rightHandSide.filter(function(item, i){ return !last[i]; }), production);
				if (!(newProduction.key() in grammar.productions))
					grammar.production(newProduction);
			}	
				
			
			while (truthCount > 0) {
				addProduction();
				for(var i = 0; i<production.rightHandSide.length; ++i) {
					if (production.rightHandSide[i] in leftHandSides) {
						if (last[i]) {
							last[i] = false;
							--truthCount;
							break;
						} else {
							last[i] = true;
							++truthCount;
						}
					}
				}
			}
			
			addProduction();
		})

	} while (more); //4. If there are still epsilon productions, go back to step 1
}

/**
 *
 *
 *
 */
Grammar.prototype.isAmbiguous = function() {
	this.actionTable.some(function(block){ return block.some(function(actions){ return actions.length > 1; }); });
}

/**
 *
 *
 *
 */
Grammar.prototype.build = function() {
	this.removeEpsilonProductions();
	this.generateFirstSets();
	this.generateStates();
	this.generateTables();
}

/**
 *
 *
 *
 */
Grammar.prototype.token = function(id) {
	this.tokens[id] = true;
	return id;
}

/**
 *
 *
 *
 */
Grammar.prototype.nonTerminal = function(id) {
	this.nonTerminals[id] = true;
	return id;
}

/**
 *
 *
 *
 */
Grammar.prototype.production = function() {
	if (arguments.length === 1) {
		return this.production(arguments[0].leftHandSide, arguments[0].rightHandSide, arguments[0].parent);
	}
	else if (arguments.length > 1) {
		var 
			leftHandSide = arguments[0],
			rightHandSide =  Array.isArray(arguments[1]) ? arguments[1] : Array.prototype.slice.call(arguments, 1),
			parent = Array.isArray(arguments[1]) ? arguments[2] : undefined;
			
		if (!leftHandSide || rightHandSide.length === 0)
			throw "Need both a left and right hand side!"
		
		if (typeof rightHandSide[0] === "object") {
			var out = [ ];
			for(var i = 0; i<rightHandSide.length; ++i)
				out.push(this.production(leftHandSide, rightHandSide[i], parent));
			return out;
		}
		else {
			var
				production = new Production(leftHandSide, rightHandSide, parent),
				key = production.key();
		
			if (this.productions[key])
				throw "Duplication production!";
			
			production.id = this.productions.length;	
			
			this.productions[key] = true;
			this.productions.push(production);
			
			return production;
		}		
	}
}

Grammar.prototype.context = function() {
	return new Parser(this);
}

/**
 *
 *
 *
 */
Grammar.create = function(opts) {
	return new Grammar(opts);
}

/**
 *
 *
 *
 */
function Production(leftHandSide, rightHandSide, parent) {
	this.leftHandSide = leftHandSide;
	this.rightHandSide = rightHandSide;
	if (parent)
		this.parent = parent;
}

/**
 *
 *
 *
 */
Production.prototype.key = function() {
	return this.leftHandSide+"->"+this.rightHandSide.join(",");
}

/**
 *
 *
 *
 */
Production.prototype.toString = function() {
	return this.leftHandSide+" -> "+this.rightHandSide.join(" ");
}

/**
 *
 *
 *
 */
function ItemSet() {

}

/**
 *
 *
 *
 */
ItemSet.prototype = [ ];

/**
 *
 *
 *
 */
ItemSet.prototype.merge = function(itemSet) {
	var self = this, added = [ ];
	itemSet.forEach(function(item){
		if (self.push(item)) {
			added.push(item);
			if (item.action instanceof Shift) 
				if (item.action.nextState === itemSet)
					item.action.nextState = self;
		}
	})
	return added;
}

/**
 *
 *
 *
 */
ItemSet.prototype.push = function(item) {
	var key = item.key();
	if (this[key])
		return false;
	this[key] = true;
	Array.prototype.push.call(this, item);
	return item;
}

/**
 *
 *
 *
 */
ItemSet.prototype.containsCore = function(other) {
	return this.some(function(item) { return item.hasIdenticalCoresWith(other); });
}

/**
 *
 *
 *
 */
ItemSet.prototype.isWeaklyCompatibleWith = function(other) {
	return this.every(function(item){ return !item.isKernel || other.containsCore(item); });
}

/**
 *
 *
 *
 */
ItemSet.prototype.hasShiftingItem = function() {
	return this.some(function(item) { return item.isShift(); });
}

/**
 *
 *
 *
 */
ItemSet.prototype.hasReducingItem = function() {
	return this.some(function(item) { return item.isReduction(); });
}

/**
 *
 *
 *
 */
ItemSet.prototype.toString = function() {
	var out = "";
	for (var i = 0; i < this.length; ++i)
		out += "\n\t" + this[i].toString();
	return (this.id >= 0 ? "#"+this.id+ " " : "")+"[" + out + "\n]";
}

/**
 *
 *
 *
 */
function Shift(shiftSymbol, shiftItem, nextState) {
	this.shiftSymbol = shiftSymbol;
	this.nextState = nextState;
	this.shiftItem = shiftItem;
}

/**
 *
 *
 *
 */
function Reduce(production, lookahead) {
	this.production = production;
	this.lookahead = lookahead;
}


/**
 *
 *
 *
 */
function Item(production, dotPosition, lookahead, isKernel, action) {
	this.production = production;
	this.dotPosition = dotPosition;
	this.lookahead = lookahead;
	this.isKernel = isKernel;
	this.action = action;
}

/**
 *
 *
 *
 */
Item.prototype.key = function() {
	return this.production.key()+"/"+this.dotPosition+"/"+this.lookahead.join();
}

/**
 *
 *
 *
 */
Item.prototype.isReduction = function() {
	return !this.isShift();
}

/**
 *
 *
 *
 */
Item.prototype.isShift = function() {
	return this.dotPosition < this.production.rightHandSide.length;
}

/**
 *
 *
 *
 */
Item.prototype.hasReductionConflictWith = function(item) {
	if (!this.isReduction() || !item.isReduction())
		return false;
	
		
	function arrayEquals(a1, a2) {
		if (a1.length != a2.length)
			return false;
		for (var i = 0; i < a1.length; ++i)
			if (a1[i] != a2[i])
				return false;
		return true;
	}	
	
	return 
		this.production.leftHandSide !== item.production.leftHandSide &&
		arrayEquals(this.lookahead, item.lookahead) &&
		arrayEquals(this.production.rightHandSide, item.production.rightHandSide) &&
		this.dotPosition == item.dotPosition;
}

/**
 *
 *
 *
 */
Item.prototype.hasIdenticalCoresWith = function(item) {
	return this.production.key() === item.production.key() && this.dotPosition === item.dotPosition;
}

/**
 *
 *
 *
 */
Item.prototype.getMarkedSymbol = function() {
	return this.production.rightHandSide[this.dotPosition];
}

/**
 *
 *
 *
 */
Item.prototype.toString = function() {
	var beforeDot = this.production.rightHandSide.slice(0, this.dotPosition).join(" ");
	var afterDot =  this.production.rightHandSide.slice(this.dotPosition).join(" ");
	return (this.isKernel ? "*" : "") + this.production.leftHandSide + " ->" + (beforeDot ? " "+beforeDot : "") + " ." + (afterDot ? " "+afterDot : "" ) + " [ " + this.lookahead.toString() + " ]";

}

module.exports = Grammar;
