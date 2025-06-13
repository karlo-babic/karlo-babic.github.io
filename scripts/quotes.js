quotes = [
    "Imagine a puddle waking up one morning and thinking,<br>\"This is an interesting world I find myself in,<br>an interesting hole I find myself in,<br>fits me rather neatly, doesn't it?<br>In fact it fits me staggeringly well,<br>must have been made to have me in it!\"<br>- Douglas Adams",
    "Life is dynamically preserved pattern.<br>- Dave Ackley",
    "I compute, therefore I am.",
    "The universe is vast cold and empty, and we are so small and insignificant.<br>The only hope humans have of being important is to each other.<br>- Nick Lucid (The Science Asylum)",
    "Big whorls have little whorls<br>That feed on their velocity,<br>And little whorls have lesser whorls<br>And so on to viscosity.<br>- Lewis F. Richardson",
    "You don't see something until you have<br>the right metaphor to let you perceive it.<br>- Thomas S. Kuhn, James Gleick<br>(Chaos: Making a New Science, 1987)",
    "That which can be destroyed by the truth, should be.<br>- P.C. Hodgell",
    "Let the winds of evidence blow you about as though you are a leaf,<br>with no direction of your own.<br>- Eliezer Yudkowsky",
    "Perfection is achieved, not when there is nothing more to add,<br>but when there is nothing left to take away.<br>- Antoine de Saint-Exupery",
    "All things change in a dynamic environment.<br>Your effort to remain what you are is what limits you.<br>- Puppet Master from Ghost in the Shell, 1995",
    "Our comforting conviction that the world makes sense rests on a<br>secure foundation: our almost unlimited ability to ignore our ignorance.<br>- Daniel Kahneman<br>(Thinking, Fast and Slow, 2011)",
    "1N73LL163NC3 15 7H3 481L17Y 70 4D4P7 70 CH4N63.<br>- Stephen Hawking",
    "Dreams are real while they last.<br>Can we say more of life?<br>- Havelock Ellis",
    "A chicken is an egg's way of making another egg.",
    "The point of life is to forget that it has no point.",
    "Love with your heart,<br>use your head for everything else.<br>- Alan Melikdjanian (Captain Disillusion)",
    "You give up the world line by line.<br>You become an accomplice to your own annihilation.<br>There's nothing you can do about it.<br>Everything you do closes a door somewhere ahead of you.<br>Finally there's only one door left.<br>- White from The Sunset Limited, 2011",
    "Those who can make you believe absurdities,<br>can make you commit atrocities.<br>- Voltaire",
    "The brain is the mind in space.<br>The mind is the brain in time.<br>- @Neuro_Skeptic",
    "Mathematics is the domain of all formal languages, i.e. all possible specifications.<br>Computation is the domain of all possible implementations.<br>To exist is to be implemented.<br>To be implemented means to be some kind of causal structure that is producing a certain behavior.<br>- Joscha Bach",
    "What computers can increasingly do is that they can produce dreams<br>and inside of these dreams it's possible that a system emerges that dreams of being conscious.<br>- Joscha Bach",
    "We are survival machines,<br>robot vehicles blindly programmed to preserve the selfish molecules known as genes.<br>- Richard Dawkins<br>(The Selfish Gene, 1976)",
    "How do you cause people to believe in an imagined order such as Christianity, democracy or capitalism?<br>First, you never admit that the order is imagined.<br>- Yuval Noah Harari<br>(Sapiens: A Brief History of Humankind, 2011)",
    "In the end, respiration and burning are equivalent;<br>the slight delay in the middle is what we know as life.<br>- Nick Lane<br>(Vital Question: Energy, Evolution, and the Origins of Complex Life, 2015)",
    "Those swirls in the cream mixing into the coffee?<br>That’s us. Ephemeral patterns of complexity, riding a wave of increasing entropy from simple beginnings to a simple end.<br>We should enjoy the ride.<br> - Sean Carroll<br>(The Big Picture: On the Origins of Life, Meaning, and the Universe Itself, 2016)",
    "The first principle is that you must not fool yourself<br>and you are the easiest person to fool.<br>- Richard Feynman",
    "I would rather have questions that can't be answered<br>than answers that can't be questioned.<br>- Richard Feynman",
    "If there is anything that truly makes humans unique,<br>it is that the mind is no longer singular<br>but is tethered to others through a long history of accumulated ideas.<br>- Max Solomon Bennett<br>(A Brief History of Intelligence, 2023)",
    "The observer is the observed.<br>- Jiddu Krishnamurti",
    "My pencil and I are more clever than I.<br>- Albert Einstein",
    "Knowledge is created by seeking good explanations.<br>- David Deutsch<br>(The Beginning of Infinity: Explanations That Transform the World, 2011)",
    "Embark on an open-ended journey of creation and exploration<br>whose every step is unsustainable until it is redeemed by the next.<br>- David Deutsch<br>(The Beginning of Infinity: Explanations That Transform the World, 2011)",
    "The whole of biological evolution was but a preface to the main story of evolution,<br>the evolution of memes.<br>- David Deutsch<br>(The Beginning of Infinity: Explanations That Transform the World, 2011)",
];

const quoteElement = document.getElementById("quote");

function showQuote() {
    const newQuote = quotes[Math.floor(Math.random() * quotes.length)];

    // Fade out the current quote
    quoteElement.style.opacity = '0';

    // Wait for the fade-out transition to finish, then update and fade in.
    setTimeout(() => {
        quoteElement.innerHTML = newQuote;
        quoteElement.style.opacity = '1';
    }, 1000); // This should match the transition duration in CSS
}

// Set the interval for subsequent quotes
setInterval(showQuote, 30 * 1000);