quotes = [
    "Imagine a puddle waking up one morning and thinking,<br>\"This is an interesting world I find myself in,<br>an interesting hole I find myself in,<br>fits me rather neatly, doesn't it?<br>In fact it fits me staggeringly well,<br>must have been made to have me in it!\"<br>- Douglas Adams",
    "Life is dynamically preserved pattern.<br>- Dave Ackley",
    "I compute, therefore I am.",
    "The universe is vast cold and empty, and we are so small and insignificant.<br>The only hope humans have of being important is to each other.<br>- Nick Lucid (The Science Asylum)",
    "You know, for a mathematician, he did not have enough imagination.<br>But he has become a poet and now he is fine.<br>- David Hilbert",
    "Big whorls have little whorls<br>That feed on their velocity,<br>And little whorls have lesser whorls<br>And so on to viscosity.<br>- Lewis F. Richardson",
    "You don't see something until you have<br>the right metaphor to let you perceive it.<br>- Thomas S. Kuhn, James Gleick (Chaos: Making a New Science, 1987)",
    "That which can be destroyed by the truth, should be.<br>- P.C. Hodgell",
    "Let the winds of evidence blow you about as though you are a leaf,<br>with no direction of your own.<br>- Eliezer Yudkowsky",
    "Perfection is achieved, not when there is nothing more to add,<br>but when there is nothing left to take away.<br>- Antoine de Saint-Exupery",
    "All things change in a dynamic environment.<br>Your effort to remain what you are is what limits you.<br>- Puppet Master from Ghost in the Shell, 1995",
    "Our comforting conviction that the world makes sense rests on a<br>secure foundation: our almost unlimited ability to ignore our ignorance.<br>- Daniel Kahneman (Thinking, Fast and Slow, 2011)",
    "1N73LL163NC3 15 7H3 481L17Y 70 4D4P7 70 CH4N63.<br>- Stephen Hawking",
    "Dreams are real while they last. Can we say more of life?<br>- Havelock Ellis",
    "A chicken is an egg's way of making another egg.",
    "The point of life is to forget that it has no point.",
    "Love with your heart, use your head for everything else.<br>- Alan Melikdjanian (Captain Disillusion)",
    "You give up the world line by line.<br>You become an accomplice to your own annihilation.<br>There's nothing you can do about it.<br>Everything you do closes a door somewhere ahead of you.<br>Finally there's only one door left.<br>- White from The Sunset Limited, 2011",
    "Those who can make you believe absurdities,<br>can make you commit atrocities.<br>- Voltaire",
    "The brain is the mind in space. The mind is the brain in time.<br>- @Neuro_Skeptic",
    "Mathematics is the domain of all formal languages, i.e. all possible specifications.<br>Computation is the domain of all possible implementations.<br>To exist is to be implemented.<br>- Joscha Bach",
    "What computers can increasingly do is that they can produce dreams<br>and inside of these dreams it's possible that a system emerges that dreams of being conscious.<br>- Joscha Bach",
    "We are survival machines,<br>robot vehicles blindly programmed to preserve the selfish molecules known as genes.<br>- Richard Dawkins (The Selfish Gene, 1976)",
    "How do you cause people to believe in an imagined order such as Christianity, democracy or capitalism?<br>First, you never admit that the order is imagined.<br>- Yuval Noah Harari (Sapiens: A Brief History of Humankind, 2011)",
    "In the end, respiration and burning are equivalent;<br>the slight delay in the middle is what we know as life.<br>- Nick Lane (Vital Question: Energy, Evolution, and the Origins of Complex Life, 2015)",
    "Those swirls in the cream mixing into the coffee?<br>That’s us. Ephemeral patterns of complexity, riding a wave of increasing entropy from simple beginnings to a simple end.<br>We should enjoy the ride.<br> - Sean Carroll (The Big Picture: On the Origins of Life, Meaning, and the Universe Itself, 2016)",
    "The first principle is that you must not fool yourself<br>and you are the easiest person to fool.<br>- Richard Feynman",
    "I would rather have questions that can't be answered<br>than answers that can't be questioned.<br>- Richard Feynman"
];

function showQuote()
{
    document.getElementById("quote").innerHTML = quotes[Math.floor(Math.random()*quotes.length)];
}

showQuote();
setInterval(showQuote, 30*1000);
