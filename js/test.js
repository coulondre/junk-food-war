/*var Car = function(loc) {
	var obj = {loc: loc};
	obj.move = function() {
		obj.loc++;
		console.log("Ami is moving")
	};
	return obj;
};

var Van = function(loc) {
	var obj = Car(loc);
	obj.grab = function() {
		console.log("Ami is grabing");
	};
	return obj;
};

var ami = Van(1);
ami.move();
ami.grab();

var Car = function(loc) {
	this.loc = loc;
};
Car.prototype.move = function() {
	this.loc++;
};
var ami = new Car(1);
console.log(ami.loc);
ami.move();
console.log(ami.loc);*/

var clientData = {
	id: 094545,
	fullName: "Not Set",
	setUserName: function(firstName, lastName) {
		console.log(this);
		this.fullName = firstName + " " + lastName;
	}
};

function getUserInput(firstName, lastName, callback) {
	callback(firstName, lastName);
};

getUserInput("barack", "obama", clientData.setUserName);

console.log(clientData.fullName);
console.log(window.fullName);