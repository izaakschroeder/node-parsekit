
var 
	Grammar = require('./grammar'), 
	Parser = require('./parser'), 
	EventEmitter = require('events').EventEmitter, 
	util = require('util');

function Lexer() {
	EventEmitter.call(this);
	this.reset();
}
util.inherits(Lexer, EventEmitter);

Lexer.tokenCharacters = {
	'>': 'immediateChild',
	'^': 'anyParent',
	'<': 'immediateParent',
	'+': 'immediateNextSibling',
	'-': 'immediatePreviousSibling',
	'+*': 'anyNextSibling',
	'-*': 'anyPreviousSibling',
	'~': 'anySibling',
	'*': 'any',
	'.': 'production',
	',': 'also',
	'(': 'openGroup',
	')': 'closeGroup'
}

Lexer.prototype.reset = function() {
	this.state = 0;
	this.buffer = "";
	this.position = 0;
}

Lexer.prototype.write = function(data) {
	
	this.buffer += data;
	
	while (this.position < this.buffer.length) {
		var input = this.buffer[this.position];

		switch(this.state) {
		case 0:
			if (input in Lexer.tokenCharacters) {
				this.emit("data", { token: Lexer.tokenCharacters[input], data: input });
				++this.position;
			}
			else if ( (input >= "a" && input <= "z") || (input >= "A" && input <= "z") ) {
				this.lastPosition = this.position;
				this.state = 4;
			}
			else {
				switch(input) {
				case '/':
					this.lastPosition = this.position + 1;
					this.state = 1;
					++this.position;
					break;
				case '"':
					this.lastPosition = this.position + 1;
					this.state = 2;
					++this.position;
					break;
				case ' ':
				case '\t':
				case '\r':
				case '\n':
					this.lastPosition = this.position;
					this.state = 3;
					break;
				default:
					this.emit("error");
					break;
				}
			}
			break;
		case 1: //regular expression
			switch(input) {
			case "\\":

				break;
			case '/':
				this.emit("data", { token: "regularExpression", data: this.buffer.substring(this.lastPosition, this.position) });
				++this.position;
				this.state = 0;
				break;
			default:
				++this.position;
				break;
			}
			break;
		case 2: //string
			switch(input) {
			case "\\":
				break;
			case '"':
				this.emit("data", { token: "string", data: this.buffer.substring(this.lastPosition, this.position) });
				++this.position;
				this.state = 0;
				break;
			default:
				++this.position;
				break;
			}
			break;
		case 3: //whitespace
			switch(input) {
			case ' ':
			case '\t':
			case '\r':
			case '\n':
				++this.position;
				break;
			default:
				this.emit("data", { token: "whitespace", data: this.buffer.substring(this.lastPosition, this.position) });
				this.state = 0;
				break;
			}
			break;
		case 4: //identifier
			if ( (input >= "a" && input <= "z") || (input >= "A" && input <= "z") || (input >= "0" && input <= "9") || input === "-" || input === "_" ) {
				++this.position;
			}
			else {
				this.emit("data", { token: "identifier", data: this.buffer.substring(this.lastPosition, this.position) });
				this.state = 0;
			}
				
			break;
		}
	}
}

Lexer.prototype.end = function() {
	switch(this.state) {
	case 0:
		break;
	case 3:
		this.emit("data", { token: "whitespace", data: this.buffer.substring(this.lastPosition, this.position) });
		this.state = 0;
		break;
	case 4:
		this.emit("data", { token: "identifier", data: this.buffer.substring(this.lastPosition, this.position) });
		this.state = 0;
		break;
	case 1:
	case 2:
		this.emit("error");
		break;
	}
	this.emit("end");
}


var grammar = new Grammar({
	tokens: [
		"identifier",
		"string",
		"regularExpression",
		"immediateChild",
		"anyParent",
		"immediateParent",
		"immediateNextSibling",
		"anyNextSibling",
		"any",
		"production",
		"also",
		"openGroup",
		"closeGroup"
	],
	rules: {

		filter: {
			immediateChildFilter: {
				rule: [ "immediateChild", "expression" ],
				dominates: [ "anyChildFilter", "alsoExpression" ],
				associativity: "left"
			},
			anyParentFilter: {
				rule: [ "anyParent", "expression" ],
				dominates: [ "anyChildFilter", "alsoExpression" ],
				associativity: "left"
			},
			immediateParentFilter: {
				rule: [ "immediateParent", "expression" ],
				dominates: [ "anyChildFilter", "alsoExpression" ],
				associativity: "left"
			},
			immediateNextSiblingFilter: {
				rule: [ "immediateNextSibling", "expression" ],
				dominates: [ "anyChildFilter", "alsoExpression" ],
				associativity: "left"
			},
			anyNextSiblingFilter: {
				rule: [ "anyNextSibling", "expression" ],
				dominates: [ "anyChildFilter", "alsoExpression" ],
				associativity: "left"
			},
			anyChildFilter: {
				rule: [ "expression" ],
				dominates: [ "alsoExpression" ],
				associativity: "left"
			}
		},
		expression: {
			symbolExpression: {
				rule: [ "identifier" ],
				dominates: [ 
					"alsoExpression",
					"anyNextSiblingFilter", 
					"anyChildFilter",
					"immediateNextSiblingFilter",
					"immediateParentFilter",
					"anyParentFilter",
					"immediateChildFilter" 
				]
			},
			productionExpression: {
				rule: [ "production", "identifier" ],
				dominates: [ 
					"alsoExpression", 
					"anyNextSiblingFilter", 
					"anyChildFilter",
					"immediateNextSiblingFilter",
					"immediateParentFilter",
					"anyParentFilter",
					"immediateChildFilter" 
				]
			},
			tokenValueExpression: {
				rule: [ "tokenValue" ],
				dominates: [  ]
			},
			allExpression: {
				rule: [ "any" ],
				dominates: [ "alsoExpression" ],
				associativity: "left"
			},
			filteredExpression: {
				rule: [ "expression", "filter" ],
				associativity: "left"
			},
			alsoExpression: {
				rule: [ "expression", "also", "expression" ],
				associativity: "left"
			},
			groupFilterExpression: {
				rule: [ "expression", "openGroup", "filter", "closeGroup" ],
				dominates: [ "alsoExpression" ],
				associativity: "left"
			}
		},
		tokenValue: {
			stringTokenValue: {
				rule: [ "string" ],
				dominates: [ 
					"anyChildFilter", 
					"alsoExpression", 
					"immediateChildFilter", 
					"anyParentFilter", 
					"immediateParentFilter", 
					"immediateNextSiblingFilter", 
					"anyNextSiblingFilter" 
				]
			},
			regularExpressionTokenValue: {
				rule: [ "regularExpression" ],
				dominates: [ 
					"anyChildFilter", 
					"alsoExpression", 
					"immediateChildFilter", 
					"anyParentFilter", 
					"immediateParentFilter", 
					"immediateNextSiblingFilter", 
					"anyNextSiblingFilter" 
				]
			}
		}
	},
	start: "expression"
});



function selector(selector, rootNode, callback) {
	var lexer = new Lexer();
	var parser = new Parser(grammar);

	lexer.on("data", function(token) {
		if (token.token === "whitespace")
			return;
		parser.write(token);
	}).on("end", function(){
		parser.end();
	});

	parser.on("immediateChildFilter", function(immediateChild, expression) {

		this.processNodeSet = function(nodeSet) {
			var children = [ ];
			nodeSet.forEach(function(node) {
				children = children.concat(node);
			})
			
			return expression.processNodeSet(children);
		}
		
	}).on("anyParentFilter", function(anyParent, expression) {

		this.processNodeSet = function(nodeSet) {
			var parents = [ ];
			nodeSet.forEach(function(node) {
				var parent = node.parent;
				while (parent !== undefined) {
					parents.push(parent);
					parent = parent.parent;
				}
			})
			return expression.processNodeSet(parents);
		}
		
	}).on("immediateParentFilter", function(immediateParent, expression) {

		this.processNodeSet = function(nodeSet) {
			var parents = nodeSet.map(function(node) { return node.parent; });
			return expression.processNodeSet(parents);
		}
		
	}).on("immediateNextSiblingFilter", function(immediateNextSibling, expression) {


		
	}).on("anyNextSiblingFilter", function(anyNextSibling, expression) {



	}).on("anyChildFilter", function(expression) {
		
		this.processNodeSet = function(nodeSet) {

			var out = [ ];
			nodeSet.forEach(function(node) {

				var child = [ node ], parent = [ ];

				while (child.length > 0) {
					var current = child.pop();
					parent.push(current);
					if (Array.isArray(current)) //Check for terminals too
						current.forEach(function(o){ child.push(o); })
				}
				parent.shift();
				expression.processNodeSet(parent).forEach(function(i){ out.push(i); });;
				
			})
			return out;
		}

	}).on("symbolExpression", function(identifier) {

		this.processNodeSet = function(nodeSet) {
			return nodeSet.filter(function(node) { 
				return node.symbol === identifier.data; 
			});
		}
		
	}).on("productionExpression", function(production, identifier) {

		this.processNodeSet = function(nodeSet) {
			return nodeSet.filter(function(node) { 
				return node.production === identifier.data; 
			});
		}
	
	}).on("tokenValueExpression", function(tokenValue) {

		this.processNodeSet = function(nodeSet) {
			return nodeSet.filter(function(node) { 
				return tokenValue.matches(node.data); 
			});
		}
		
	}).on("allExpression", function(all) {

		this.processNodeSet = function(nodeSet) {
			return nodeSet;
		}		

	}).on("filteredExpression", function(expression, filter) {
		
		this.processNodeSet = function(nodeSet) {
			return filter.processNodeSet(expression.processNodeSet(nodeSet));
		}

	}).on("alsoExpression", function(expressionA, also, expressionB) {

		this.processNodeSet = function(nodeSet) {
			var out = [ ];
			expressionA.processNodeSet(nodeSet);
			expressionB.processNodeSet(nodeSet);
			return out;
		}
		
	}).on("groupFilterExpression", function(expression, openGroup, filter, closeGroup) {
		
		this.processNodeSet = function(nodeSet) {
			return expression.processNodeSet(nodeSet).filter(function(node) {
				return filter.processNodeSet([node]).length > 0;
			})
		}

	}).on("stringTokenValue", function(token) {
		this.matches = function(input) {
			return input === token.data;
		}
	}).on("regularExpressionTokenValue", function(token) {
		var regex = new RegExp(token.data);
		this.matches = function(input) {
			return regex.test(input);
		}
	}).on("end", function(expression) {
		//console.log(expression);
		var child = [ rootNode ], parent = [ ];

		while (child.length > 0) {
			var current = child.pop();
			parent.push(current);
			if (Array.isArray(current)) //Check for terminals too
				current.forEach(function(o){ child.push(o); })
		}
		expression.processNodeSet(parent).forEach(callback);
	})

	lexer.write(selector);
	lexer.end();
}

var sampleGrammar = new Grammar({
	tokens: [ "identifier", "comma", "semiColon" ],
	rules: {
		vdecl: { typedVdecl: [ "type", "idList", "semiColon" ] },
		type: { idType: [ "identifier" ] },
		idList: {
			singleIdList: [ "identifier" ],
			multiIdList: [ "idList", "comma", "identifier" ]
		}
	},
	start: "vdecl"
});

var sampleParser = new Parser(sampleGrammar);

sampleParser.on("end", function(root) {

	selector("vdecl ", root, function(node) {
		console.log("Got node: "+node.symbol);
	})

	selector("vdecl > idList identifier", root, function(node) {
		console.log("Got node: "+node.data);
	})

	
	selector('vdecl > type "int"', root, function(node) {
		console.log("Got node: "+node.data)
	})

	
	selector('vdecl ( > type "int" )', root, function(node) {
		console.log("Got node: "+node.symbol);
	})
	
	selector('"int" ^ type', root, function(node) {
		console.log("Got node: "+node.symbol);
	})
	
	selector('"int" ( < type )', root, function(node) {
		console.log("Got node: "+node.data)
	})
	
	selector('identifier ^ vdecl > type', root, function(node) {
		console.log("Got node: "+node.symbol);
	})
	/*
	selector('vdecl ( type + idList + ";" )', root, function() {
		
	})
	*/
})

var tokens = [
	{ token: "identifier", data: "int" },
	{ token: "identifier", data: "x" },
	{ token: "comma", data: "," },
	{ token: "identifier", data: "y" },
	{ token: "comma", data: "," },
	{ token: "identifier", data: "z" },
	{ token: "semiColon", data: ";" }
]

tokens.forEach(function(token){
	sampleParser.write(token)
})
sampleParser.end();


exports.selector = selector;