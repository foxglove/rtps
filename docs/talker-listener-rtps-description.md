1.  _9a35_ broadcasts participant info
2.  _9a35_ broadcasts participant info
3.  _9a35_ broadcasts participant info
4.  _c54e_ sends participant info to _9a35_
5.  _c54e_ sends 3x heartbeats for advertised builtins: pubsWriter, subsWriter, participantMsgWriter
6.  _9a35_ sends 3x heartbeats for advertised builtins: pubsWriter, subsWriter, participantMsgWriter
7.  _c54e_ sends 3x acknack responses to received heartbeats, reporting all available msgs as missing
8.  _9a35_ sends 3x acknack responses to received heartbeats, opportunistic for pubsWriter/subsWriter and participantMsgWriter single msg missing
9.  _c54e_ sends `AUTOMATIC_LIVELINESS_UPDATE` to _c54e_ with accompanying heartbeat
10. _c54e_ sends publication info for `ros_discovery_info`, `rt/rosout`, `rr/listener/get_parametersReply`, `rr/listener/get_parameter_typesReply`, and `rr/listener/set_parametersReply`
11. _c54e_ sends publication info for `rr/listener/set_parameters_atomicallyReply`, `rr/listener/describe_parametersReply`, `rr/listener/list_parametersReply`, and `rt/parameter_events`, and subscription info for `ros_discovery_info` (entityId 0x0504, app-defined reader no-key)
12. _c54e_ sends subscription info for `rq/listener/get_parametersRequest`, `rq/listener/get_parameter_typesRequest`, `rq/listener/set_parametersRequest`, and `rq/listener/set_parameters_atomicallyRequest`
13. _c54e_ sends subscription info for `rq/listener/describe_parametersRequest`, `rq/listener/list_parametersRequest`, `rt/parameter_events`, and `rt/chatter`, heartbeat for publications (seq 1-9), `AUTOMATIC_LIVELINESS_UPDATE`, heartbeat for subscriptions (seq 1-9), and heartbeat for liveliness update
14. _c54e_ sends acknack for liveliness update
15. _9a35_ sends 3x acknacks for pubs, subs, and liveliness updates
16. _9a35_ sends publication info for `ros_discovery_info`
17. _9a35_ sends subscription info for `ros_discovery_info`
18. _9a35_ sends seq 1 payload for `ros_discovery_info` w/ no info_dst, and accompanying heartbeat
19. _c54e_ sends acknack for `ros_discovery_info`
20. _9a35_ sends seq 1 payload for `ros_discovery_info` to _c54e_, and accompanying heartbeat
21. _c54e_ sends acknack for `ros_discovery_info`
22. _c54e_ sends `ros_discovery_info` heartbeat advertising one message
23. _9a35_ sends `ros_discovery_info` acknack indicating one lost message
