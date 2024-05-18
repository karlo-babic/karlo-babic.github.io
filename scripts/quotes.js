quotes = [
    "Imagine a puddle waking up one morning and thinking,<br>\"This is an interesting world I find myself in,<br>an interesting hole I find myself in,<br>fits me rather neatly, doesn't it?<br>In fact it fits me staggeringly well,<br>must have been made to have me in it!\"<br>- Douglas Adams",
    "Life is dynamically preserved pattern.<br>- Dave Ackley",
    "I compute, therefore I am.",
    "The universe is vast cold and empty, and we are so small and insignificant.<br>The only hope humans have of being important is to each other.<br>- The Science Asylum",
    "If you only do what you can do, you’ll never be more than you are now.<br>- Master Shifu",
    "You know, for a mathematician, he did not have enough imagination.<br>But he has become a poet and now he is fine.<br>- David Hilbert",
    "Big whorls have little whorls<br>That feed on their velocity,<br>And little whorls have lesser whorls<br>And so on to viscosity.<br>- Lewis F. Richardson",
    "You don't see something until you have<br>the right metaphor to let you perceive it.<br>- Thomas S. Kuhn",
    "That which can be destroyed by the truth, should be.<br>- P.C. Hodgell",
    "Let the winds of evidence blow you about as though you are a leaf,<br>with no direction of your own.<br>- Eliezer Yudkowsky",
    "Perfection is achieved, not when there is nothing more to add,<br>but when there is nothing left to take away.<br>- Antoine de Saint-Exupery",
    "All things change in a dynamic environment.<br>Your effort to remain what you are is what limits you.<br>- Puppet Master",
    "Our comforting conviction that the world makes sense rests on a<br>secure foundation: our almost unlimited ability to ignore our ignorance.<br>- Daniel Kahneman",
    "1N73LL163NC3 15 7H3 481L17Y 70 4D4P7 70 CH4N63.<br>- Stephen Hawking",
    "Dreams are real while they last. Can we say more of life?<br>- Havelock Ellis",
    "A chicken is an egg's way of making another egg.",
    "The point of life is to forget that it has no point.",
    "Love with your heart, use your head for everything else.<br>- Alan Melikdjanian (Captain Disillusion)",
    "You give up the world line by line.<br>You become an accomplice to your own annihilation.<br>There's nothing you can do about it.<br>Everything you do closes a door somewhere ahead of you.<br>Finally there's only one door left.<br>- White from The Sunset Limited (2011)",
    "Those who can make you believe absurdities,<br>can make you commit atrocities.<br>- Voltaire",
    "The brain is the mind in space. The mind is the brain in time.<br>- @Neuro_Skeptic"
];

function showQuote()
{
    document.getElementById("quote").innerHTML = quotes[Math.floor(Math.random()*quotes.length)];
}

setInterval(showQuote, 15*1000);
