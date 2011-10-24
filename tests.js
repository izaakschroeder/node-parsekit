
var 
	assert = require('assert'), util = require('util'),
	Grammar = require('./grammar'),
	Parser = require('./parser');

function firstSet1() {

	var grammar = Grammar.create({
		tokens: [
			"qus",
			"lbr",
			"rbr",
			"str",
			"exl"
		],
		rules: {
			session: [
				["facts", "question"],
				["lbr", "session", "rbr", "session"]
			],
			facts: [
				[ "fact", "facts" ],
				[ Grammar.epsilon ]
			],
			fact: [
				[ "exl", "str" ]
			],
			question: [
				[ "qus", "str" ]
			]
		},
		start: "session"
	});
	
	grammar.generateFirstSets();
	
	var firstSet;
	
	firstSet = grammar.firstSets["exl"];
	assert.ok("exl" in firstSet && Object.getOwnPropertyNames(firstSet).length == 1);
	
	firstSet = grammar.firstSets["qus"];
	assert.ok("qus" in firstSet && Object.getOwnPropertyNames(firstSet).length == 1);
	
	firstSet = grammar.firstSets["lbr"];
	assert.ok("lbr" in firstSet && Object.getOwnPropertyNames(firstSet).length == 1);
	
	firstSet = grammar.firstSets["rbr"];
	assert.ok("rbr" in firstSet && Object.getOwnPropertyNames(firstSet).length == 1);
	
	firstSet = grammar.firstSets["str"];
	assert.ok("str" in firstSet && Object.getOwnPropertyNames(firstSet).length == 1);
	
	firstSet = grammar.firstSets["session"];
	assert.ok("exl"in firstSet && "lbr" in firstSet && "qus" in firstSet && Object.getOwnPropertyNames(firstSet).length == 3);
	
	firstSet = grammar.firstSets["facts"];
	assert.ok("exl" in firstSet && Grammar.epsilon in firstSet && Object.getOwnPropertyNames(firstSet).length == 2);
	
	firstSet = grammar.firstSets["fact"];
	assert.ok("exl" in firstSet && Object.getOwnPropertyNames(firstSet).length == 1);
	
	
	firstSet = grammar.firstSets["question"];
	assert.ok("qus" in firstSet && Object.getOwnPropertyNames(firstSet).length == 1);
}

function derp() {
	
	var grammar = Grammar.create({
		tokens: [
			"qus",
			"lbr",
			"rbr",
			"str",
			"exl"
		],
		rules: {
			session: [
				["facts", "question"],
				["lbr", "session", "rbr", "session"]
			],
			facts: [
				[ "fact", "facts" ],
				[ Grammar.epsilon ]
			],
			fact: [
				[ "exl", "str" ]
			],
			question: [
				[ "qus", "str" ]
			]
		},
		start: "session"
	});
	
	grammar.build();
	
	
	var parser = Parser.create(grammar);
	
	parser.on("shift", function(token) {
		console.log("Shifted "+token);
	});
	
	parser.on("reduce", function(rightHandSide, production) {
		console.log("Reduced to "+production.leftHandSide+"; ("+rightHandSide+")");
	});
	
	Tree.build(parser, function(tree) {
		console.log("Got parse tree: "+util.inspect(tree, false, null));
	})
	
	function parse(string) {
		parser.reset();
		string.split(" ").forEach(function(token){ parser.feed(token); });
		parser.endOfStream();
	}
	
	parse("lbr qus str rbr exl str qus str");
	
	
	try {
		parse("lbr str");
		assert.ok(false);
	} catch (e) {
		assert.ok(true);
		console.log("Expected any of: "+parser.expects());
	}
	
}



derp();

