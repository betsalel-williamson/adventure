# Persona — Agent builder

## Name

**Agent builder Avery**

## Description

Avery builds and iterates **systems of prompts and agentic behaviors** so an **automated player** can **play** Colossal Cave–style text adventure, **explore** rooms and connections, **solve puzzles**, and **learn** which strategies work. Avery cares about **accurate labeling** (what is scripted, what is adaptive), **fast feedback** after changing configuration, and **trust**—hints and assists must never read like canonical game text. Avery is not satisfied by engineering dashboards unless they clarify **what the agent did and why** in plain language.

## User story voice

Use **As an Agent builder Avery** (or **As an agent builder**) in stories under this hub so requirements stay aligned with this persona.

## Goals

- Define **project configuration** clearly enough to reason about **what Avery controls** versus what the **shared experience** always provides.
- **Run** automated play and **see results** that support the next iteration (**configure → run → learn**).
- Rely on **honest run labels** so scripted or deterministic paths are never mistaken for full autonomy.
- Tell **assistive or draft content** apart from **room and parser output** from the game.

## Pains

- Misleading names (“autoplay” when behavior is a fixed script).
- Opaque failures with no **actionable** next step.
- Unclear ownership: “Is this my agent, the platform, or the game?”

## Success (plain language)

**WHEN** Avery finishes a session **THEN** Avery **SHALL** be able to say **what changed**, **what the run demonstrated**, and **what to try next**—without reading implementation docs.

## Navigation

[index.md](index.md) · [stories/index.md](stories/index.md)
