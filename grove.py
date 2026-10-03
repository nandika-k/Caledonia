"""Form-neutral population and growth logic for the enchanted grove."""

from dataclasses import asdict, dataclass
import math
from typing import Iterable, Mapping


@dataclass(frozen=True)
class ActivityEntry:
    """One authenticated person's submitted activity; hours are additive."""

    google_sub: str
    email: str
    activity_name: str
    hours: float
    description: str
    activity_type: str
    organization_person_name: str | None = None


def activity_entry_from_form(
    form: Mapping[str, object], authenticated_user: Mapping[str, str]
) -> ActivityEntry:
    """Validate form fields and attach identity from the verified login session."""
    google_sub = authenticated_user.get("google_sub", "").strip()
    email = authenticated_user.get("email", "").strip()
    if not google_sub or not email:
        raise ValueError("a signed-in user is required")

    activity_name = str(form.get("activity_name", "")).strip()
    description = str(form.get("description", "")).strip()
    activity_type = str(form.get("activity_type", "")).strip().lower()
    organizer = str(form.get("organization_person_name", "")).strip() or None
    try:
        hours = float(str(form.get("hours", "")).strip())
    except ValueError as exc:
        raise ValueError("hours must be a number") from exc

    if not activity_name:
        raise ValueError("activity name is required")
    if not math.isfinite(hours) or hours <= 0:
        raise ValueError("hours must be a finite number greater than zero")
    if not description:
        raise ValueError("description is required")
    if activity_type not in {"internal", "external"}:
        raise ValueError("activity type must be internal or external")

    return ActivityEntry(
        google_sub=google_sub,
        email=email,
        activity_name=activity_name,
        hours=hours,
        description=description,
        activity_type=activity_type,
        organization_person_name=organizer,
    )


@dataclass(frozen=True)
class GroveRecord:
    """One person's form data, normalized by the form adapter."""

    id: str
    hours: float
    name: str | None = None


@dataclass(frozen=True)
class GroveScale:
    min_height: float
    max_height: float
    hours_at_max_height: float


@dataclass(frozen=True)
class GrovePlant:
    id: str
    hours: float
    name: str | None
    growth: float
    canopy_scale: float
    height: float
    position: tuple[float, float, float]
    glow: str = "standard"

    def to_dict(self) -> dict:
        """Return JSON-ready values for a Flask response."""
        plant = asdict(self)
        plant["position"] = list(self.position)
        return plant


def plant_height(hours: float, scale: GroveScale) -> float:
    """Map logged hours linearly to a capped height."""
    if not math.isfinite(hours) or hours < 0:
        raise ValueError("hours must be finite and non-negative")
    if (
        not math.isfinite(scale.min_height)
        or not math.isfinite(scale.max_height)
        or scale.max_height < scale.min_height
        or not math.isfinite(scale.hours_at_max_height)
        or scale.hours_at_max_height <= 0
    ):
        raise ValueError("scale needs finite heights and positive hours_at_max_height")

    progress = min(hours / scale.hours_at_max_height, 1.0)
    return scale.min_height + progress * (scale.max_height - scale.min_height)


def _hash_id(value: str) -> int:
    """Stable 32-bit FNV-1a hash, independent of Python's randomized hash."""
    result = 2166136261
    for char in value:
        result ^= ord(char)
        result = (result * 16777619) & 0xFFFFFFFF
    return result


def build_grove(people: Iterable[GroveRecord], scale: GroveScale) -> list[GrovePlant]:
    """Build one stable plant per person; a repeated ID uses the latest record."""
    unique: dict[str, GroveRecord] = {}
    for person in people:
        if not person.id.strip():
            raise ValueError("each person needs a stable, non-empty id")
        unique[person.id] = person

    plants = []
    for person in unique.values():
        identity_hash = _hash_id(person.id)
        angle = identity_hash / 2**32 * math.tau
        radius = 3 + math.sqrt(_hash_id(f"{person.id}:radius") / 2**32) * 30
        growth = min(person.hours / scale.hours_at_max_height, 1.0)
        plants.append(
            GrovePlant(
                id=person.id,
                hours=person.hours,
                name=person.name,
                growth=growth,
                canopy_scale=growth,
                height=plant_height(person.hours, scale),
                position=(math.cos(angle) * radius, 0.0, math.sin(angle) * radius),
            )
        )
    return plants
