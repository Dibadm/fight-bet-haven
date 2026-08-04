
INSERT INTO public.weight_classes (id, name, limit_kg) VALUES
 ('11111111-0000-0000-0000-000000000001','Flyweight',56.7),
 ('11111111-0000-0000-0000-000000000002','Lightweight',70.3),
 ('11111111-0000-0000-0000-000000000003','Welterweight',77.1),
 ('11111111-0000-0000-0000-000000000004','Middleweight',83.9),
 ('11111111-0000-0000-0000-000000000005','Heavyweight',120.2);

INSERT INTO public.fighters (id, full_name, nickname, nationality, record_w, record_l, record_d) VALUES
 ('22222222-0000-0000-0000-000000000001','Dawit Bekele','The Highlander','Ethiopia',14,2,0),
 ('22222222-0000-0000-0000-000000000002','Marcus Vieira','Cobra','Brazil',18,4,1),
 ('22222222-0000-0000-0000-000000000003','Yonas Tesfaye','Steel','Ethiopia',11,1,0),
 ('22222222-0000-0000-0000-000000000004','Danil Orlov','The Bear','Kazakhstan',9,3,0),
 ('22222222-0000-0000-0000-000000000005','Samuel Adeyemi','Blade','Nigeria',16,5,0),
 ('22222222-0000-0000-0000-000000000006','Kenji Sato','Typhoon','Japan',13,6,2);

INSERT INTO public.events (id, name, promotion, venue, country, starts_at, status) VALUES
 ('33333333-0000-0000-0000-000000000001','Addis Fight Night 12','Habesha Fighting Championship','Millennium Hall, Addis Ababa','Ethiopia', now() + interval '5 days','published');

INSERT INTO public.fights (id, event_id, fighter_a_id, fighter_b_id, weight_class_id, scheduled_rounds, starts_at, is_main_event, bout_order, status) VALUES
 ('44444444-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000004',5, now() + interval '5 days' + interval '4 hours', true, 1,'open'),
 ('44444444-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000002',3, now() + interval '5 days' + interval '3 hours', false, 2,'open'),
 ('44444444-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000006','11111111-0000-0000-0000-000000000003',3, now() + interval '5 days' + interval '2 hours', false, 3,'open');

-- Moneyline markets
INSERT INTO public.markets (id, fight_id, market_type_code, name, status, closes_at) VALUES
 ('55555555-0000-0000-0000-000000000011','44444444-0000-0000-0000-000000000001','moneyline','Fight Winner','open', now() + interval '5 days' + interval '4 hours'),
 ('55555555-0000-0000-0000-000000000012','44444444-0000-0000-0000-000000000001','method_of_victory','Method of Victory','open', now() + interval '5 days' + interval '4 hours'),
 ('55555555-0000-0000-0000-000000000013','44444444-0000-0000-0000-000000000001','round_group','Round Markets','open', now() + interval '5 days' + interval '4 hours'),
 ('55555555-0000-0000-0000-000000000021','44444444-0000-0000-0000-000000000002','moneyline','Fight Winner','open', now() + interval '5 days' + interval '3 hours'),
 ('55555555-0000-0000-0000-000000000022','44444444-0000-0000-0000-000000000002','method_of_victory','Method of Victory','open', now() + interval '5 days' + interval '3 hours'),
 ('55555555-0000-0000-0000-000000000031','44444444-0000-0000-0000-000000000003','moneyline','Fight Winner','open', now() + interval '5 days' + interval '2 hours'),
 ('55555555-0000-0000-0000-000000000032','44444444-0000-0000-0000-000000000003','round_group','Round Markets','open', now() + interval '5 days' + interval '2 hours');

INSERT INTO public.selections (market_id, label, odds, outcome_spec, sort_order) VALUES
 ('55555555-0000-0000-0000-000000000011','Dawit Bekele to win',1.720,'{"winner":"fighter_a"}',1),
 ('55555555-0000-0000-0000-000000000011','Marcus Vieira to win',2.150,'{"winner":"fighter_b"}',2),
 ('55555555-0000-0000-0000-000000000011','Draw',18.000,'{"winner":"draw"}',3),
 ('55555555-0000-0000-0000-000000000012','Dawit by KO/TKO',3.400,'{"winner":"fighter_a","method":"ko_tko"}',1),
 ('55555555-0000-0000-0000-000000000012','Dawit by Submission',5.500,'{"winner":"fighter_a","method":"submission"}',2),
 ('55555555-0000-0000-0000-000000000012','Dawit by Decision',4.200,'{"winner":"fighter_a","method":"decision"}',3),
 ('55555555-0000-0000-0000-000000000012','Marcus by KO/TKO',4.800,'{"winner":"fighter_b","method":"ko_tko"}',4),
 ('55555555-0000-0000-0000-000000000012','Marcus by Submission',4.100,'{"winner":"fighter_b","method":"submission"}',5),
 ('55555555-0000-0000-0000-000000000012','Marcus by Decision',5.000,'{"winner":"fighter_b","method":"decision"}',6),
 ('55555555-0000-0000-0000-000000000012','Draw or No Contest',20.000,'{"method":"draw"}',7),
 ('55555555-0000-0000-0000-000000000013','Fight ends in Round 1',6.500,'{"ends_in_round":1}',1),
 ('55555555-0000-0000-0000-000000000013','Fight ends in Round 2',6.000,'{"ends_in_round":2}',2),
 ('55555555-0000-0000-0000-000000000013','Fight ends in Round 3',7.000,'{"ends_in_round":3}',3),
 ('55555555-0000-0000-0000-000000000013','Goes the distance',1.950,'{"goes_distance":true}',4),
 ('55555555-0000-0000-0000-000000000021','Yonas Tesfaye to win',1.450,'{"winner":"fighter_a"}',1),
 ('55555555-0000-0000-0000-000000000021','Danil Orlov to win',2.900,'{"winner":"fighter_b"}',2),
 ('55555555-0000-0000-0000-000000000022','Yonas by KO/TKO',2.700,'{"winner":"fighter_a","method":"ko_tko"}',1),
 ('55555555-0000-0000-0000-000000000022','Yonas by Decision',3.600,'{"winner":"fighter_a","method":"decision"}',2),
 ('55555555-0000-0000-0000-000000000022','Danil by KO/TKO',5.200,'{"winner":"fighter_b","method":"ko_tko"}',3),
 ('55555555-0000-0000-0000-000000000022','Danil by Decision',6.400,'{"winner":"fighter_b","method":"decision"}',4),
 ('55555555-0000-0000-0000-000000000031','Samuel Adeyemi to win',1.880,'{"winner":"fighter_a"}',1),
 ('55555555-0000-0000-0000-000000000031','Kenji Sato to win',1.980,'{"winner":"fighter_b"}',2),
 ('55555555-0000-0000-0000-000000000032','Fight ends in Round 1',5.800,'{"ends_in_round":1}',1),
 ('55555555-0000-0000-0000-000000000032','Fight ends in Round 2',5.400,'{"ends_in_round":2}',2),
 ('55555555-0000-0000-0000-000000000032','Fight ends in Round 3',6.200,'{"ends_in_round":3}',3),
 ('55555555-0000-0000-0000-000000000032','Goes the distance',1.750,'{"goes_distance":true}',4);
