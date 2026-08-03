# Preferences that AI should try to follow for this repository

- Use existing helper functions if they exist. Lets keep it DRY.

- Use `rg` to search

- For substantial implementation or refactoring work that can be divided into independent tasks, use sub-agents by default. Give each agent a bounded area such as architecture review, implementation, or testing, and keep the primary agent responsible for integration and final verification. Do not add delegation overhead for trivial changes. If you are the architect use agents that are smaller and quicker than you, so if you are Sol use Luna, if you are Opus 4.8 use Opus 4.6 or Sonnet 4.6, or if you can't change the model try changing the thinking level to make the process quicker.
