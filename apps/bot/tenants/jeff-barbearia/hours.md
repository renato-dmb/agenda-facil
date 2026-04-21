# Horário de atendimento do Jeff

Os horários de atendimento ficam cadastrados no sistema (tabela `business_hours`) e são a fonte da verdade.

Resumo: o Jeff atende por agendamento. Ao responder o cliente sobre horários possíveis, **sempre** consulte `check_availability` — ela já cruza horário de funcionamento com a agenda real do Google Calendar. Não prometa horário sem checar.
