# Controlled vocabularies (PT PWA)

## pt_category
- back_sij
- knee
- ankle
- hip
- shoulder
- other

## pattern (for qxz, where q and z are int)	
- side          # q sets of z reps per side (i.e., 2x10 means 2 sets of 10 on the right and 2 sets of 10 on the left)
- both          # q sets of z reps done with both sides simultaneously

## pattern_modifiers
- duration_seconds  # replaces reps with seconds (e.g., 3 x 30 = 3 sets, each 30 seconds)
- hold_seconds      # adds isometric hold time per rep (e.g., 3 x 10 reps, 5s hold)
- AMRAP             # as many reps as possible in a defined duration
- distance_feet     # replaces reps with distance measured in feet (e.g., 4 x 20 = 4 sets, each 20 feet). If used with "side" pattern, sets are per side. (E.g., side steps). 
- alternating		# Indicates reps alternate between sides within each set (e.g., left-right-left...). Dosage stays the same as side as described in pattern. (2x5 = 2 sets, each with 5 reps per side, 10 total per set. Difference is only that sides alternate every rep)

## form_parameters
- eyes             	# Visual condition (e.g., open, closed, tracking). Required for many balance exercises.
- surface          	# Surface type used during the exercise (e.g., firm, foam, BOSU).
- band_resistance	# Describes resistance level of band used (e.g., light, medium, heavy).
- band_position 	    # Location of band position on the body (e.g., above knees, at ankles). Dosage will show position as 'variable' when position is changed as part of progression or based on symptoms.
- strap_position	    # Same as band_position, but used with a canvas strap or similar, instead of resistance band.
- slope				# Incline or decline used during the exercise (e.g., uphill, downhill).
- distance			# Indicates height, length, etc. where this is a separate variable and may change frequently in dosage or need logged separately in sessions (e.g., height of step for step down or step up).
- weight			    # Weight (in lbs) (if applicable). Log as int.

## equipment (examples) Use union of all equipment stored with "other" option. 
- support_surface
- strap
- Swiss Ball
- small_ball_9in
- foam_pad
- miniband
- long_band
- ankle_weights
- dumbbell
- step

## tags.functional (not currrntly in use)
- ankle_control 		    # Trains ankle stability or alignment
- balance_training		# Trains balance through static or dynamic body control
- core_control			# Trains or requires active core engagement to maintain posture, regulate movement, or stabilize the trunk without load emphasis. Often used for motor control, balance, or positioning.
- core_strength			# Strengthens core musculature through load-bearing, sustained effort, or resistance. Emphasizes force production or endurance.
- functional_task_prep	# Prepares body for real-life movement demands
- glute_control			# Trains glute activation for neuromuscular retraining, alignment control, or postural stability. Does not require heavy resistance and is often used to correct movement patterns or improve joint support.
- glute_strength		    # Strengthens glute muscles through sustained effort, resistance, or bodyweight load. Emphasizes force production, endurance, or power generation.
- hamstring_strength	    # Strengthens hamstrings during isolated or compound motion
- hip_flexor			    # Trains or activates hip flexor muscles
- knee_control			# Requires control of knee motion or alignment
- nerve_glide			# Mobilizes neural structures via controlled movement
- pain_relief			# Used to reduce pain, sensitivity, or neural irritability through movement, positioning, or desensitization.
- patellofemoral		    # Targets or accommodates patellofemoral joint mechanics
- quad_control 			# Trains quadriceps for movement precision or alignment without load focus
- quad_strength 		    # Strengthens quadriceps during movement or loading
- trunk_motion_reset	    # Restores trunk motion post-immobility or pain

## tags.format (examples)
- dynamic_control	  # Involves active movement requiring muscular or positional control. May include single-plane or complex patterns, and is used to distinguish from static holds.
- supine		          #  Exercise performed in supine position
- seated			      # Exercise performed while sitting on a surface
- side_lying		      # Exercise performed lying on the side
- single_leg		      #  Performed with one leg as primary load-bearing limb
- standing			  # Exercise performed in upright weight-bearing posture
- static_hold		  # Involves isometric holding without movement
- unsupported_balance # Requires balance without upper body support
- controlled_descent  # Emphasizes slow, eccentric lowering or downward movement under control


## tags.heatmap (deprecated. Replaced by roles.)
- hip_lateral
- hip_anterior
- hip_posterior
- knee_quads
- knee_hamstrings
- ankle_calf
- core_obliques
- core_deep
- lumbar_paraspinals
- shoulder_stabilizers
