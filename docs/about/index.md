---
title: "About"
---

![Me, having breakfast on a houseboat (Rotterdam, Netherlands, 2022)](./me.jpg)

Hey! My name is Stefan R. Seil and this is my blog. I am <span id="age">AGE</span> years old and live in Munich, Germany. My passions include video game programming, procedural generation, music and philosophy. I hold a M.Sc. in computer science and a B.A. in philosophy, both from LMU Munich. Since graduating, I have worked as a fullstack web developer, attempted to create multiple video games, and now work at [twobrains](https://twobrains.com).

If you want to contact me, feel free to send an email to [contact@srseil.com](mailto:contact@srseil.com).

<script>
	const birthday = new Date(1997, 1, 7);
	const today = new Date();
	let age = today.getFullYear() - birthday.getFullYear();
	const monthDiff = today.getMonth() - birthday.getMonth();
	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
		age--;
	}
	document.getElementById("age").textContent = age;
</script>
