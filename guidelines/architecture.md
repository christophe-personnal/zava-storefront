# Architecture Guidelines

## Principes Directeurs

### **DDD (Domain-Driven Design)**
- Parler le langage du métier
- **Bounded Contexts** : délimiter les domaines métier explicitement
- **Ubiquitous Language** : utiliser la même terminologie dans le code, les tests et le domaine
- Entities, Value Objects, Aggregates : modéliser fidèlement le domaine

### **Clean Architecture**
- Dépendre d'abstractions, pas de détails concrets
- Indépendance vis-à-vis des frameworks, bases de données et UI
- Layers : Domain → Application → Infrastructure → Adapters
- Direction des dépendances : toujours vers le centre (Domain)

### **SOLID**
- **S**ingle Responsibility : une classe = une raison de changer
- **O**pen/Closed : ouvert à l'extension, fermé à la modification
- **L**iskov Substitution : sous-types interchangeables
- **I**nterface Segregation : clients ne dépendent pas d'interfaces qu'ils n'utilisent pas
- **D**ependency Inversion : dépendre d'abstractions

### **Object Calisthenics**
- 1 niveau d'indentation par méthode (lisibilité)
- Pas plus de 50 lignes par méthode
- 1 point (.) par ligne (pas de chaînes de calls)
- Ne pas utiliser `else`
- Initialiser les collections sans les remplir dans le constructeur
- 1 niveau d'indentation = 1 abstraction
- Préférer la composition à l'héritage
- Pas d'abbreviations (readability first)

---

## Architecture Decision Records (ADR)

### **Pourquoi des ADR ?**
- Documenter les décisions architecturales et leur contexte
- Traçabilité des changements
- Onboarding des nouveaux membres

### **Où les stocker ?**
```
./adr/
  ├── 0001-choose-framework.md
  ├── 0002-domain-events.md
  └── README.md (index)
```

### **Template ADR (MADR 3.0)**
```markdown
# [ADR-XXXX] Titre de la décision

## Context
Quels sont les enjeux architecturaux ou métier ?

## Decision
Quelle est la solution choisie et pourquoi ?

## Consequences
- Avantages
- Inconvénients / coûts
- Impacts sur d'autres domaines

## Statut
Accepted | Rejected | Superseded by ADR-YYYY

## Related ADRs
- ADR-ZZZZ
```

### **Validation des ADR**
- Respecter les ADR existants dans toute nouvelle contribution
- Toute déviation : créer un nouvel ADR ou amender l'existant
- Révision architecte avant merge

---

## Tests

### **Tests de Comportement (BDD - Behavior Driven Development)**
- **Écrire les tests en fonction du métier**, pas de l'implémentation technique
- Format : **Given / When / Then**
  ```
  Given l'utilisateur est authentifié
  When il commande 10 articles
  Then le panier contient 10 articles et le montant est correct
  ```

### **Structure des tests**
```
src/
  ├── domain/
  │   ├── __tests__/           ✓ Tests de domaine
  │   └── order.ts
  ├── application/
  │   ├── __tests__/           ✓ Tests d'orchestration
  │   └── order.service.ts
  └── infrastructure/
      ├── __tests__/           ✓ Tests d'intégration (DB, HTTP, etc.)
      └── order.repository.ts
```

### **Couvrir le comportement**
```
❌ NE PAS TESTER :
  - L'implémentation interne (getters, setters triviaux)
  - Les libs externes (on fait confiance)
  - Les détails du framework

✅ TESTER :
  - Les règles métier (price calculation, validation)
  - Les cas limites (edge cases)
  - Les chemins d'erreur
  - Les séquences complexes (orchestration)
```

### **Pyramid des tests**
- 70% Tests unitaires (domaine + logique métier)
- 20% Tests d'intégration (domain + repositories, adapters)
- 10% Tests E2E (happy paths critiques)

---

## Layering & Dépendances

### **Structure type**
```
domain/                    (Entités, value objects, règles métier)
  └── order/
      ├── Order.ts         (Aggregate root)
      ├── OrderLine.ts     (Entity)
      ├── Price.ts         (Value object)
      ├── IOrderRepository.ts (Interface)
      └── __tests__/
        └── order.spec.ts

application/               (Orchestration, use cases)
  └── order/
      ├── CreateOrderService.ts
      ├── GetOrderService.ts
      └── __tests__/

infrastructure/            (Implémentations, adapters)
  └── persistence/
      ├── OrderRepository.ts (implements IOrderRepository)
      └── __tests__/

adapters/                  (HTTP, CLI, Events)
  ├── http/
  │   └── OrderController.ts
  └── events/
      └── OrderEventHandler.ts
```

### **Règle d'or**
- Domain n'a **aucune dépendance externe**
- Application dépend du domain et d'abstractions (interfaces)
- Infrastructure implémente les interfaces du domain
- Injection des dépendances dans le constructeur

---

## Review Checklist

- [ ] Architecture conforme aux ADR existants (ou nouvel ADR créé)
- [ ] Respect de SOLID et Object Calisthenics
- [ ] Tests couvrent le comportement métier, pas l'implémentation
- [ ] Pas de dépendances circulaires
- [ ] Domain layer indépendant d'frameworks et libs externes
- [ ] Interfaces clairement définies aux boundaries
