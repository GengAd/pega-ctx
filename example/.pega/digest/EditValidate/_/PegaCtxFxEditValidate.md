# EditValidate PegaCtxFxEditValidate
class: 
rulesets: Test:01-01-01
application: Test
description: PegaCtxFxEditValidate
updated: 2026-10-12 by dev.un
available: yes

work class: MONORG-Test-Work

## Code
```java
if (!"true".equalsIgnoreCase(theValue)) {
  theProperty.addMessage("This field must be true.");
  return false;
}
return true;
```

## References
none

## Cited by
none
