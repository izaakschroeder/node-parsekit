
function Disambiguator() {
	
}

Disambiguator.prototype.postProcess = function(grammar) {
	var precedenceMap = [ ];
	grammar.productions.forEach(function(production, id) {
		
		if (production.dominates || production.associativity) {
			precedenceMap[id] = { };
			
			if (production.dominates)
				precedenceMap[id].dominates = Array.isArray(production.dominates) ? production.dominates : [ production.dominates ];
			else
				precedenceMap[id].dominates = [ ];
				
			if (production.associativity)
				precedenceMap[id].associativity = production.associativity;
			else
				precedenceMap[id].associativity = "none";
				
			precedenceMap[id].dominates = precedenceMap[id].dominates.map(function(name){
				if (typeof name === "number")
					return name;
				else
					return grammar.productionMap[name];
			})
		}
		
	});
		
	this.disambiguate(grammar, precedenceMap)
}

Disambiguator.prototype.disambiguate = function(grammar, precedenceMap) {
	
	
	function compare(a1, a2) {
		var 
			p1 = a1.production,
			p2 = a2.production,
			pr1 = precedenceMap[p1],
			pr2 = precedenceMap[p2];
		
		if (pr2 && pr2.dominates.indexOf(p1) !== -1) {
			return a2;
		}
		else if (pr1 && pr1.dominates.indexOf(p2) !== -1) {
			return a1;
		}
		else if (pr1 && pr2 && pr1.associativity === pr2.associativity) {
			switch(pr1.associativity) {
			case "left":
				return a1;
			case "right":
				return a2;
			case "none":
			case undefined:
				return undefined;
			default:
				throw "Associativity is "+pr1.associativity+"; which is neither left, right or none.";
			}
		}
		return undefined;
	}
	
	var count = 0;
	grammar.actionTable.forEach(function(block, state){
		for (var lookahead in block) {
			var changed = false,
				actions = block[lookahead];
			
			do {
				changed = false;
				for (var i = 0; (i < actions.length) && !changed; ++i) {
					var a1 = actions[i];
					for (var j = 0; (j < actions.length) && !changed; ++j) {
						
						if (j == i)
							break;
													
						var a2 = actions[j];
						var result = compare(a1, a2);
						if (result) {
							actions.splice(i, 1);
							actions.splice(j > i ? j - 1 : j, 1);
							actions.push(result);
							changed = true;
						}
						else {
							var t1 = typeof a1.nextState !== "undefined" ? "shift" : "reduce",
							t2 = typeof a2.nextState !== "undefined" ? "shift" : "reduce";
							console.log("UNRESOLVED "+t1+"/"+t2+" Contention between: ");
							console.log(grammar.productions[a1.production].toString());
							console.log(grammar.productions[a2.production].toString());
							++count;
						}
					}
				}
			} while(changed);	
		}
	})
	
	//console.log("Ambiguities: "+count);
}

module.exports = Disambiguator;