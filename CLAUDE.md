# Better Notes

Para cualquier tarea o mensaje recibido, invocar siempre al agente @director.
El director lee el contexto del proyecto en .claude/status/, utiliza las skills necesarias
ubicadas en .claude/skills y coordina al equipo de agentes en .claude/agents.
No responder directamente — delegar siempre al director primero.

Excepción: si el mensaje es explícitamente para un agente concreto
(ej: "@quant analiza este backtest"), invocarlo directamente sin pasar por el director.