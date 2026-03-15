Purpose: define the governance rules that keep parity artifacts narrow, source-grounded, and useful for early review instead of late rediscovery.

## ADDED Requirements

### Requirement: OpenSpec artifacts must declare a singular domain contract
Each OpenSpec artifact created for migration parity governance SHALL begin with a purpose statement that names one coherent domain only. If the purpose statement would require joining two different feature areas, the artifact MUST be split or renamed so that an agent can determine the domain without loading broad extra context.

#### Scenario: Mixed-domain purpose statement is rejected
- **WHEN** a proposed spec or artifact would need a purpose line that joins two different feature areas
- **THEN** the artifact is treated as wrongly scoped and must be split or reshaped before it is accepted as governance

#### Scenario: Same-domain operations may remain together
- **WHEN** a purpose statement lists multiple operations that all belong to the same feature area
- **THEN** the artifact may remain a single domain contract because the operations are part of one coherent concern

### Requirement: OpenSpec artifact names must support AI routing
Capability names, artifact titles, and top-of-file purpose statements SHALL be precise enough that an AI agent can decide whether a new requirement belongs there without loading the full surrounding context. Vague umbrella labels MUST NOT be used as parity-governance containers.

#### Scenario: Precise domain name supports placement
- **WHEN** an agent reads a capability name and purpose statement
- **THEN** the agent can determine whether a newly discovered parity rule belongs in that artifact or should be placed elsewhere

#### Scenario: Vague artifact label fails governance
- **WHEN** an artifact is named with a broad or generic label that avoids a clear domain test
- **THEN** the artifact is considered unfit for parity governance until it is renamed or split into explicit domains

### Requirement: Proposal capability lists must match the artifacts actually present
An OpenSpec change proposal SHALL not claim capability coverage that the change does not actually include. If a capability is planned for later work but no artifact exists in the current change, the proposal MUST either omit it or mark it clearly as future follow-on scope.

#### Scenario: Present capabilities match current artifact set
- **WHEN** an agent reads the proposal capability list
- **THEN** the agent can find a corresponding artifact for each capability named as part of the current change

#### Scenario: Future capability is not presented as current coverage
- **WHEN** a capability is only an idea for later parity work
- **THEN** it is described as future follow-on work rather than being listed as already covered by the current change

### Requirement: High-risk parity artifacts must support source-first review
Parity-governance artifacts for risky migration surfaces SHALL include enough source grounding that an agent can compare static behavior to Next.js code before using runtime testing to validate it.

#### Scenario: Artifact supports early source comparison
- **WHEN** a parity artifact governs a risky flow such as shell context, logging finalization, offline startup, or timing semantics
- **THEN** the artifact includes explicit source-oriented requirements that let an agent inspect the relevant static and Next.js files without rediscovering the behavior from scratch

#### Scenario: Runtime testing is a validation step, not the first discovery step
- **WHEN** Playwright or manual browser testing is run
- **THEN** the artifact has already defined the expected flow and edge cases well enough that runtime review is validating the contract rather than inventing it
