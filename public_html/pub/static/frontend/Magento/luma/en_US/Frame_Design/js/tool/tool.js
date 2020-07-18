setTimeout(function () {
	require([
		'jquery',"bootbox", "bootstrap-min", "jquery/ui", "jcanvas", "jcanvasHandle", "spectrum", "noty-pack",  "domReady!",'jquery/jquery.cookie'
	], function ($,bootbox) {
		$(document).ready(function () {
			$canvas = $('#mainCanvas');
			var currentTab= 1;
			var dimension = 0;
			var frameUse = '';
			var frameWidth = 0;
			var scale = 1;
			var currentId=DEFAULT_VALUES.defaultFrameID
			var currentWidth=DEFAULT_VALUES.defaultFrameWidth;
			var mattList = '';
			var CanvasSize = {
				width: 600 * scale,
				height: 720 * scale
			};

			var MattSize = {
				width: 600 * scale,
				height: 720 * scale
			};

			var TopBoxSize = {
				width: 402 * scale,
				height: 322 * scale,
				border: DEFAULT_VALUES.LayerThickness * scale
			};

			var EmbillishSize = {
				width: 120 * scale,
				height: 120 * scale
			};

			var PlateSize = {
				width: 201 * scale,
				height: 101 * scale
			};

			var CanvasBackground = {
				type: 'image',
				source: '',
				x: 0,
				y: 0,
				width: MattSize.width + (2 * currentWidth),
				height: MattSize.height + (2 * currentWidth),
				name: 'backgroundframe',
				groups: ['backgroundGrp'],
				fromCenter: false,
				intangible:true,
				load: function (e) {
					$('.canvas-loader').addClass('hidden');
					$('#mainCanvas').removeClass('hidden');
				}
			};

			var CanvasBackgroundLayer = {
					type: 'image',
					source: '',
					x: 0,
					y: 0,
					width: MattSize.width,
					height: MattSize.height,
					name: 'topmatt',
					groups: ['backgroundGrp'],
					fromCenter: false,
					intangible:true,
					load: function (e) {
						$('.canvas-loader').addClass('hidden');
						$('#mainCanvas').removeClass('hidden');
					}
				}

			var TopBoxLayer = {
					type: 'image',
					source: '',
					x: 0,
					y: 0,
					width: TopBoxSize.width + (3 * TopBoxSize.border),
					height: TopBoxSize.height + (3 * TopBoxSize.border),
					fromCenter: false,
					name:'TopboxLayer',
					groups: ['backgroundGrp'],
				}				

			var BaseImageLayer = {
				type: 'image',
				draggable: false,
				source: '',
				x: 0,
				y: 0,
				width: 0,
				height: 0,
				name: '',
				groups: ['backgroundGrp'],
				align: 'center',
				respectAlign: false,
				rotate: 0,
				fromCenter: false,
				constrainProportions: true,
				maxWidth: 0,
				cursors: '',
				visible: true,
				drag: ''
			};

			var BaseTextLayer = {
				fillStyle: '',
				x: 0,
				y: 0,
				fontSize: DEFAULT_VALUES.fontSize,
				fontFamily: DEFAULT_VALUES.fontFamily,
				text: '',
				type: 'text',
				maxWidth: PlateSize.width,
				name: '',
				groups: ['backgroundGrp'],
				rotate: 0,
				radius: 0,
				fromCenter: false,
				layer: true,
				draggable: false,
				align: 'center',
				respectAlign: false,
			};

			/*=== @@@START@@@ DEFAULT INITIALIZATION OF FORM WIDGETS ===*/
			$(function (e) {
				initializeCanvas();
				$('#borderThick').val(DEFAULT_VALUES.LayerThickness);
				$('#fontSize').val(DEFAULT_VALUES.fontSize);
				$('#fontFamilySelected').html(DEFAULT_VALUES.fontFamily);
				$('#prevcanv').hide();
				getEmbellishments();
				getMatt();
				initializeTextBoxFontFamily();
				
				$("#fontSize").bind('change keyup mouseup',function (e) {
					//if(parseInt($(this).val()) < 30 )
						//fs= 30;
					//else
					//alert($(this).val());
					fs=parseInt($(this).val());
					if (typeof getElement(BaseTextLayer.name) != typeof undefined) {					

						updateElement(BaseTextLayer.name, {
							fontSize: fs
						});
						resizeText(e,fs);
						var textSize = $canvas.measureText(BaseTextLayer.name);					
						var newX = (PlateSize.width-textSize.width)/2+$canvas.getLayer('plateLayer').x;
						updateElement(BaseTextLayer.name,{
							x:newX
						});
						$('.previewcanvas').addClass('loadingPreview');
						$('.btn-next').addClass('btn-next-disable');						 
						setTimeout(function() {
							getPreviewCanvas();
						}, 100);
					}					
				});

				$('[data-toggle=tab]').on('show.bs.tab', function (e) {	
					getPreviewCanvas();
				});

				$(".selected-radio-btn").click(function(){
					dimension = $(this).find("input[name='dimention']").val();
					//alert(dimension);
					if(dimension == 1){
						CanvasSize = {
							width: 600 * scale,
							height: 720 * scale
						};
						MattSize = {
							width: 600 * scale,
							height: 720 * scale
						};
						TopBoxSize = {
							width: 402 * scale,
							height: 322 * scale,
							border: DEFAULT_VALUES.LayerThickness * scale
						};
						$('#textaddcls').removeClass('horizontal');
						$('#textaddcls').removeClass('vertical');
						$('#textaddcls').addClass('horizontal');
						$('.previewcanvas').attr('style','width:100%;height:409px');
					}
					else{
						CanvasSize = {
							width: 500 * scale,
							height: 769 * scale
						};
						MattSize = {
							width: 500 * scale,
							height: 769 * scale
						};
						TopBoxSize = {
							width: 309 * scale,
							height: 386 * scale,
							border: DEFAULT_VALUES.LayerThickness * scale
						};
						$('#textaddcls').removeClass('horizontal');
						$('#textaddcls').removeClass('vertical');
						$('#textaddcls').addClass('vertical');
						$('.previewcanvas').attr('style','width:100%;height:510px');
					}
					$(".selected-radio-btn").removeClass("active");
					$(this).addClass("active");
					$(this).find("input[name='dimention']").attr("checked",true);
					initializeCanvas();
					$('.previewcanvas').addClass('loadingPreview');
					$('.btn-next').addClass('btn-next-disable');
					var textSize = $canvas.measureText(BaseTextLayer.name);					
						var newX = (PlateSize.width-textSize.width)/2+$canvas.getLayer('plateLayer').x;
						updateElement(BaseTextLayer.name,{
							x:newX
						});
					getPreviewCanvas();
					$("#dimentionbar").html($(this).find("input[name='dimention']").data('name'));
					$("#dimentionbar").parent('div').addClass('selectClass');
				});

				$('.btn-next-tab').click(function (e) {
					if(dimension != 0){						
						$( 'a[href="#step'+$(this).data("id")+'"]').tab('show');
						$( 'a[href="#step'+$(this).data("id")+'"]' ).removeClass( 'not-active' );
						$( "html, body" ).animate({ scrollTop: 0 }, "slow");					
					}
				});

				$('.framecls').click(function (e) {
					var src= "<img src="+$(this).find('img').attr('src')+" width='100' />";
					$("#framebar").html(src);
					$("#framebar").parent('div').addClass('selectClass');
					generateframe($(this).find('img').data('id'),$(this).find('img').data('width'));
					$('.previewcanvas').addClass('loadingPreview');
					$('.btn-next').addClass('btn-next-disable');
					setTimeout(function() {
						getPreviewCanvas();
					}, 1000);
					$( '#step3 li' ).removeClass( 'active' );
					$(this).parent('li').addClass( 'active' );
				});

				$('#text').bind('keyup mouseup keydown', function (e) {
				
					BaseTextLayer.name = 'textLayer';
					BaseTextLayer.text = $('#text').val();
					BaseTextLayer.width = PlateSize.width;
					BaseTextLayer.height = PlateSize.height;
					BaseTextLayer.x=	$canvas.getLayer('plateLayer').x + 20;
					BaseTextLayer.y=	$canvas.getLayer('plateLayer').y+10;
					var fontFamily = $('#fontFamilySelected').data('value')?$('#fontFamilySelected').data('value') : DEFAULT_VALUES.fontFamily;
					var fontFile = $('#fontFamilySelected').data('file_name')?$('#fontFamilySelected').data('file_name'): DEFAULT_VALUES.fontFile;
					var fontSize = $('#fontSize').val()?$('#fontSize').val() : DEFAULT_VALUES.fontSize;
					var fillStyle = $('#textColor').val() ? $('#textColor').val() : DEFAULT_VALUES.textColor;
					BaseTextLayer.fontSize= fontSize;
					BaseTextLayer.fillStyle= fillStyle;
					BaseTextLayer.fontFamily= fontFamily;
					if($('#text').val().length == 0){
						$('#fontSize').val(DEFAULT_VALUES.fontSize);
					}
					$("#textbar").html($('#text').val());
					$("#textbar").parent('div').addClass('selectClass');
					resizeText(e,fontSize);
					var textSize = $canvas.measureText(BaseTextLayer.name);					
					if (typeof getElement(BaseTextLayer.name) != typeof undefined) {
						updateElement(BaseTextLayer.name, {
							text: $('#text').val(),
							width: PlateSize.width,
							height:	PlateSize.height,
							fontSize: BaseTextLayer.fontSize,
							fontFamily: BaseTextLayer.fontFamily,
							x: BaseTextLayer.x,
							y: BaseTextLayer.y
						});
					} else {
						addElement(BaseTextLayer);
					}				
					var newX = (PlateSize.width-textSize.width)/2+$canvas.getLayer('plateLayer').x;
					updateElement(BaseTextLayer.name,{
						x:newX
					});
					$('.previewcanvas').addClass('loadingPreview');
					$('.btn-next').addClass('btn-next-disable');
					setTimeout(function() {
						getPreviewCanvas();
					}, 100);

				});				
				function resizeText(e,fontSize){
					var textSize = $canvas.measureText(BaseTextLayer.name);
					if(textSize.width+2 >= PlateSize.width || textSize.height+2 >= PlateSize.height){						
							fontSize--;
							$('#fontSize').val(fontSize);
							updateElement( BaseTextLayer.name, { fontSize: fontSize});
							console.log("fontSize",fontSize);
							resizeText(e, fontSize);
					}
					
					// else if(textSize.width+2 < PlateSize.width || textSize.height+2 < PlateSize.height){						
					// 		fontSize++;
					// 		$('#fontSize').val(fontSize);
					// 		updateElement( BaseTextLayer.name, { fontSize: fontSize});
					// 		resizeText(e, fontSize);
					// }
				}
				// TOGGLE FONT FAMILY DROPDOWN
				$('#fontFamilySelected').click(function (e) {
					$('#fontFamily').toggleClass('hidden');
				});

				// UPDATE CANVAS TEXT ON FONT FAMILY CHANGE
				$('body').on('click', 'div#fontFamily ul li', function (e) {

					var fontFamily = $(this).data('value');	

					if ($('#fontFamilySelected').data('value') != fontFamily) {

						$('#fontFamilySelected').css('fontFamily', fontFamily);

						$('#fontFamilySelected').data('value', fontFamily);					

						$('#fontFamilySelected').html($(this).html());

						if (typeof getElement(BaseTextLayer.name) != typeof undefined) {

							updateElement(BaseTextLayer.name, {

								fontFamily: fontFamily

							});

						}

						$('#fontFamily').addClass('hidden');
						$('.previewcanvas').addClass('loadingPreview');
						$('.btn-next').addClass('btn-next-disable');
						setTimeout(function() {

							getPreviewCanvas();

						}, 100);
					}

				});

				$('body').on('click', 'ul.topmattlist li', function (e) {

					var src= "<img src="+$(this).find('img').data('src')+" width='100' id='selmattimg' />";					

					$("#topmattbar").html(src);

					$("#topmattbar").parent('div').addClass('selectClass');

					CanvasBackgroundLayer.source = $(this).find('img').data('src');

					source = CanvasBackgroundLayer.source;

					CanvasBackgroundLayer.x=currentWidth;

					CanvasBackgroundLayer.y=currentWidth; 

					if (typeof getElement('topmatt') != typeof undefined) {

						updateElement(CanvasBackgroundLayer.name, {

							source: source,

							x:currentWidth,

							y:currentWidth							

						});						

					} else {						

						addElement(CanvasBackgroundLayer);				

					}
					$('.previewcanvas').addClass('loadingPreview');
					$('.btn-next').addClass('btn-next-disable');
					setTimeout(function() {

						getPreviewCanvas();

					}, 1000);
					$( '#step4 li' ).removeClass( 'active' );
					$(this).addClass( 'active' );
				});

				$('body').on('click', 'ul.bottommattlist li', function (e) {

					var src= "<img src="+$(this).find('img').data('src')+" width='100' id='selsecmattimg' />";					

					$("#bottommattbar").html(src);

					$("#bottommattbar").parent('div').addClass('selectClass');

					TopBoxLayer.source = $(this).find('img').data('src');

					TopBoxLayer.x = currentWidth + ((MattSize.width/2)- (boxWidth/2));

					TopBoxLayer.y = currentWidth + ((MattSize.height/6)- (boxHeight/6));

					if (typeof getElement('topmatt') != typeof undefined) {

						updateElement(TopBoxLayer.name, {

							source: TopBoxLayer.source,

							x:TopBoxLayer.x,

							y:TopBoxLayer.y							

						});						

					} else {						

						addElement(TopBoxLayer);				

					}
					$('.previewcanvas').addClass('loadingPreview');
					$('.btn-next').addClass('btn-next-disable');
					setTimeout(function() {

						getPreviewCanvas();

					}, 1000);
					$( '#step5 li' ).removeClass( 'active' );
					$(this).addClass( 'active' );

				});

				$('.platelist').click(function (e) {
					var src= "<img src="+$(this).find('img').data('src')+" width='100' />";
					$("#platebar").html(src);
					$("#platebar").parent('div').addClass('selectClass');
					$( '#step8 li' ).removeClass( 'active' );
					$(this).parent('li').addClass( 'active' );
					$('.previewcanvas').addClass('loadingPreview');
					$('.btn-next').addClass('btn-next-disable');
					setTimeout(function() {
						getPreviewCanvas();
					}, 1000);
				});

				$('#image-files').click(function (e) {
					if(typeof $('#uploadImgPath').attr('src') === typeof undefined)
						return false;
					BaseImageLayer.name = 'uploadImageLayer';
					BaseImageLayer.source = $('#uploadImgPath').attr('src');
					BaseImageLayer.width = TopBoxSize.width+10;
					BaseImageLayer.height = TopBoxSize.height+10;
					BaseImageLayer.x=	currentWidth + ((MattSize.width/2)- (TopBoxSize.width/2))-4;
					BaseImageLayer.y=	currentWidth + ((MattSize.height/6)- (TopBoxSize.height/6))+7;
					if (typeof getElement('uploadImageLayer') != typeof undefined) {
						source=$('#uploadImgPath').attr('src');
						updateElement(BaseImageLayer.name, {
							source: source,
							width: BaseImageLayer.width,
							height:	BaseImageLayer.height,
							x: BaseImageLayer.x,
							y: BaseImageLayer.y
						});			

					} else {
						addElement(BaseImageLayer);
					}
					$('.previewcanvas').addClass('loadingPreview');
					$('.btn-next').addClass('btn-next-disable');
					setTimeout(function() {
						getPreviewCanvas();
					}, 1000);
				});

				$('body').on('click', 'div#embellishListBody ul.emilishlist li', function (e) {			

					var img = new Image();
					img.src = $(this).find('img').data('src');
					dataImg = $(this).find('img').data('src');
					$( '#step6 li' ).removeClass( 'active' );
					$(this).addClass( 'active' );
					img.onload = function() {
						EmbillishSize.width=Math.ceil((this.width / this.height)*EmbillishSize.height);
						BaseImageLayer.name = 'embillishLayer';
						BaseImageLayer.source = img.src;
						BaseImageLayer.width = EmbillishSize.width;
						BaseImageLayer.height = EmbillishSize.height;
						BaseImageLayer.x=	currentWidth + ((MattSize.width/2)- (EmbillishSize.width/2));
						BaseImageLayer.y=	$canvas.getLayer('uploadImageLayer').y + $canvas.getLayer('uploadImageLayer').height + 25;
						if (typeof getElement('embillishLayer') != typeof undefined) {
							updateElement(BaseImageLayer.name, {
								source: BaseImageLayer.source,
								width: EmbillishSize.width,
								height:	BaseImageLayer.height,
								x: BaseImageLayer.x,
								y: BaseImageLayer.y
							});
						} else {
							addElement(BaseImageLayer);	
						}
						var src= "<img src="+ dataImg +" width='100' id='embilishsidelay' />";
						$("#embilshbar").html(src);
						$("#embilshbar").parent('div').addClass('selectClass');						
						$('.previewcanvas').addClass('loadingPreview');
						$('.btn-next').addClass('btn-next-disable');
						setTimeout(function() {
							getPreviewCanvas();
						}, 1000);
					}
				});

				$('body').on('click', 'ul.platelist li', function (e) {

					BaseImageLayer.name = 'plateLayer';

					BaseImageLayer.source = $(this).find('img').attr('src');

					BaseImageLayer.width = PlateSize.width;

					BaseImageLayer.height = PlateSize.height;

					BaseImageLayer.x=	currentWidth + ((MattSize.width/2)- (PlateSize.width/2));

					BaseImageLayer.y=	$canvas.getLayer('uploadImageLayer').y + $canvas.getLayer('uploadImageLayer').height + $canvas.getLayer('embillishLayer').height + 50;

					if (typeof getElement('plateLayer') != typeof undefined) {

						updateElement(BaseImageLayer.name, {

							source: BaseImageLayer.source,

							width: BaseImageLayer.width,

							height:	BaseImageLayer.height,

							x: BaseImageLayer.x,

							y: BaseImageLayer.y					

						});						

					} else {						

						addElement(BaseImageLayer);				

					}
					$( '#step7 li' ).removeClass( 'active' );
					$(this).addClass( 'active' );
					//$( 'a[href="#step8"]' ).removeClass( 'not-active' );

					//$( '[data-toggle="tab"][href="#step8"]' ).trigger( 'click' );

				});

				$("#textColor").spectrum({

					color: DEFAULT_VALUES.textColor,

					className: "full-spectrum",

					showInitial: true,

					showPalette: true,

					showSelectionPalette: true,

					maxSelectionSize: 10,

					preferredFormat: "hex",

					palette: DEFAULT_VALUES.palette,

					hide: function (color) {

						console.log("Text Color Changed Onclick", color.toHexString());						

						updateElement(BaseTextLayer.name, {

							fillStyle: color.toHexString()

						});

					}

				});	

			});

			/*=== @@@START@@@ COMMON LOGIC ===*/
			// ADD ANY ELEMENT ON CANVAS
			function addElement(element) {
				if ($.isArray(element)) {
					for (var i = 0; i < element.length; i++) {
						$canvas.addLayer(element[i]).drawLayers();
					}
				} else {
					console.log(element);
					$canvas.addLayer(element).drawLayers();
					$canvas.moveLayer(CanvasBackground.name, $canvas.getLayers().length - 1);
					$canvas.moveLayer(CanvasBackgroundLayer.name, 0);
				}
			}

			// REMOVE ANY ELEMENT ON CANVAS
			function deleteElement(elementName, isGroup) {

				var isGroup = typeof isGroup !== 'undefined' ? isGroup : false;

				isGroup ? $canvas.removeLayerGroup(elementName).drawLayers() : $canvas.removeLayer(elementName).drawLayers();

			}

			// UPDATE ANY ELEMENT ON CANVAS
			function updateElement(elementName, obj, isGroup) {

				var isGroup = typeof isGroup !== 'undefined' ? isGroup : false;

				isGroup ? $canvas.setLayerGroup(elementName, obj).drawLayers() : $canvas.setLayer(elementName, obj).drawLayers();

			}

			// GET DETAILS OF ANY ELEMENT ON CANVAS
			function getElement(elementName, isGroup) {
				var isGroup = typeof isGroup !== 'undefined' ? isGroup : false;
				return isGroup ? $canvas.getLayerGroup(elementName) : $canvas.getLayer(elementName);
			}

			// GENERAL FUNCTION FOR MESSAGE NOTIFICATION
			function notifyMessage(message, type) {

				$.noty.closeAll();

				var n = noty({

					text: message,

					type: type,

					theme: 'relax',

					timeout: 5000,

					animation: {

						open: 'animated bounceInDown',

						close: 'animated bounceOutUp',

						easing: 'swing',

						speed: 500

					}

				});

			}

			function getPreviewCanvas() {
				var newwidth = newheight=0;
				if(dimension == 1){
					newwidth=400;
					newheight=480;
				}
				else{
					newwidth=300;
					newheight=461;
				}
				var img="<img src='"+$('#mainCanvas').getCanvasImage('png')+"' width='"+newwidth+"' height='"+newheight+"'>";
				$('.previewcanvas').html(img);
				$('.previewcanvas').removeClass('loadingPreview');
				$('.btn-next').removeClass('btn-next-disable');
			}

			
			function initializeTextBoxFontFamily() {
				var url = BASE_URL+'design/FrameDesign/';				
				$.ajax({
					type: 'GET',
					url: url,
					data: { "type":'family'},
					beforeSend: function () {},
					success: function (response) {						
						var optionHtml = '';
						for (indx in response) {
							optionHtml += '<li style="font-family:\'' + response[indx].family + '\';" data-value="' + response[indx].family + '">' + response[indx].name + '</li>';
						}
						$('#fontFamily ul').html(optionHtml);
					},
					error: function (response) {
						response = response.responseText;
						response = JSON.parse(response);
					}
				});
			}

			// GENERAL FUNCTION FOR CANVAS MESSAGE NOTIFICATION
			function notifyCanvasMessage(message, type) {

				canvasNoty = $('.box-wrap .noty-loader').noty({

					text: message,

					type: type,

					theme: 'relax',

					animation: {

						open: 'animated flipInX',

						close: 'animated flipOutX',

						easing: 'swing',

						speed: 500

					}

				});

			}

			// INITIALIZE CANVAS AT FIRST LOAD TIME
			function initializeCanvas() {
				if (typeof currentId != typeof undefined) {
					id=currentId;
					width=currentWidth;	
				}
				else if($.cookie('frameId')){
					var t = ($.cookie('frameId')).split("@");
					id = t[0];
					width = t[1];
				}
				else if (typeof id === typeof undefined) {
					id = DEFAULT_VALUES.defaultFrameID;
					width = DEFAULT_VALUES.defaultFrameWidth;
				}
				generateframe(id,width);
			}

			function generateframe(id,width){
				currentWidth=width;
				currentId=id;
				$('#framewidth').val(currentWidth);
				$('#frameId').val(currentId);
				$('#mainCanvas').attr('width', CanvasSize.width + (2 * width));
				$('#mainCanvas').attr('height', CanvasSize.height + (2 * width));
				$('#previewCanvas').attr('width',CanvasSize.width + (2 * width));
				$('#previewCanvas').attr('height',CanvasSize.height + (2 * width));	
				CanvasBackground.source = FRAME_URL+id+".png";
				CanvasBackground.width = CanvasSize.width + (2 * width);

				CanvasBackground.height = CanvasSize.height + (2 * width);

				CanvasBackground.fromCenter = false;

				if (typeof getElement(CanvasBackground.name) != typeof undefined) {

					updateElement(CanvasBackground.name, {

						source: CanvasBackground.source,

						width:CanvasBackground.width,

						height:CanvasBackground.height						

					});	

				} 

				else {										

					addElement(CanvasBackground);

				}
				
				if ($('#selmattimg').attr('src') == undefined)  {
					CanvasBackgroundLayer.source = FRAME_URL+"matt/"+DEFAULT_VALUES.defaultMatt;
				}
				else{
					CanvasBackgroundLayer.source = $('#selmattimg').attr('src');
				}
				CanvasBackgroundLayer.width = MattSize.width;

				CanvasBackgroundLayer.height = MattSize.height;

				CanvasBackgroundLayer.x = currentWidth;

				CanvasBackgroundLayer.y = currentWidth;

				if (typeof getElement(CanvasBackgroundLayer.name) != typeof undefined) {

					updateElement(CanvasBackgroundLayer.name, {	

						source:	CanvasBackgroundLayer.source,				

						width: MattSize.width,

						height: MattSize.height,

						x: CanvasBackgroundLayer.x,

						y: CanvasBackgroundLayer.y					

					});	

				}
				else {										

					addElement(CanvasBackgroundLayer);

				}
				
				boxWidth=TopBoxSize.width + (3 * TopBoxSize.border);

				boxHeight = TopBoxSize.height + (3 * TopBoxSize.border);

				TopBoxLayer.width = boxWidth+2;

				TopBoxLayer.height = boxHeight+6;

				TopBoxLayer.x = currentWidth + ((MattSize.width/2)- (boxWidth/2));

				TopBoxLayer.y = currentWidth + ((MattSize.height/6)- (boxHeight/6));

				if ($('#selsecmattimg').attr('src') == undefined)  {
					TopBoxLayer.source = FRAME_URL+"matt/"+DEFAULT_VALUES.defaultSecondMatt;
				}
				else{
					TopBoxLayer.source = $('#selsecmattimg').attr('src');
				}

				

				if (typeof getElement(TopBoxLayer.name) != typeof undefined) {

					updateElement(TopBoxLayer.name, {							

						width: TopBoxLayer.width,

						height: TopBoxLayer.height,

						x: TopBoxLayer.x,

						y: TopBoxLayer.y						

					});	

				}				
				else {										
					addElement(TopBoxLayer);

				}
				//Manage Image Layer
				if ($('#uploadImgPath').attr('src') == undefined)  {
					if(dimension == 1)
						BaseImageLayer.source = FRAME_URL + DEFAULT_VALUES.defaultImage;
					else
						BaseImageLayer.source = FRAME_URL + DEFAULT_VALUES.defaultImageVer;
				}
				else{
					BaseImageLayer.source = $('#uploadImgPath').attr('src');
				}

				BaseImageLayer.width = TopBoxSize.width+10;

				BaseImageLayer.height = TopBoxSize.height+10;

				BaseImageLayer.x=	currentWidth + ((MattSize.width/2)- (TopBoxSize.width/2))-3;

				BaseImageLayer.y=	currentWidth + ((MattSize.height/6)- (TopBoxSize.height/6))+8;

				if (typeof getElement('uploadImageLayer') != typeof undefined) {								

					updateElement('uploadImageLayer', {
						source: BaseImageLayer.source,
						width: BaseImageLayer.width,
						height:	BaseImageLayer.height,
						x: BaseImageLayer.x,
						y: BaseImageLayer.y
					});
				}
				else {										
					BaseImageLayer.name='uploadImageLayer';
					addElement(BaseImageLayer);

				}
				//Manage Embillishment Layer
				var width = EmbillishSize.width;
				if ($('#embilishsidelay').attr('src') == undefined)  {
					BaseImageLayer.source = BASE_URL + "pub/media/gallery/image/" + DEFAULT_VALUES.defaultEmbellish;
					width = 194;
				}
				else{
					BaseImageLayer.source = $('#embilishsidelay').attr('src');
				}
				BaseImageLayer.width = width;
				BaseImageLayer.height = EmbillishSize.height;
				BaseImageLayer.x=	currentWidth + ((MattSize.width/2)- (BaseImageLayer.width/2));
				BaseImageLayer.y=	$canvas.getLayer('uploadImageLayer').y + $canvas.getLayer('uploadImageLayer').height+25;			

				if (typeof getElement('embillishLayer') != typeof undefined) {
					updateElement('embillishLayer', {
						source: BaseImageLayer.source,
						width: BaseImageLayer.width,
						height:	BaseImageLayer.height,
						x: BaseImageLayer.x,
						y: BaseImageLayer.y
					});
				}
				else{
					BaseImageLayer.name='embillishLayer';
					addElement(BaseImageLayer);
				}
				if ($('#platebar').find('img').attr('src') == undefined)  {
					BaseImageLayer.source = FRAME_URL + "plate/" + DEFAULT_VALUES.defaultPlate;
				}
				else{
					BaseImageLayer.source = $('#platebar').find('img').attr('src');
				}
				BaseImageLayer.width = PlateSize.width;
				BaseImageLayer.height = PlateSize.height;
				BaseImageLayer.x=	currentWidth + ((MattSize.width/2)- (PlateSize.width/2));
				BaseImageLayer.y=	$canvas.getLayer('uploadImageLayer').y + $canvas.getLayer('uploadImageLayer').height + $canvas.getLayer('embillishLayer').height + 50;
				if (typeof getElement('plateLayer') != typeof undefined) {
					updateElement('plateLayer', {
						source: BaseImageLayer.source,
						x: BaseImageLayer.x,
						y: 	BaseImageLayer.y
					});
				}
				else {										
					BaseImageLayer.name='plateLayer';
					addElement(BaseImageLayer);
				}
				//Manage Text Layer
				if (typeof getElement(BaseTextLayer.name) != typeof undefined) {
					BaseTextLayer.x=	$canvas.getLayer('plateLayer').x + 20;
					BaseTextLayer.y=	$canvas.getLayer('plateLayer').y + 5;
					updateElement(BaseTextLayer.name, {
						x: BaseTextLayer.x,
						y: BaseTextLayer.y
					});	
				}
			}			

			// EXECUTE ON ENTER PRESS OF SVG CATEGORY SEARCH BOX
			$('body').on('keyup', 'input#searchText', function (e) {
				if (e.keyCode == 13)
					getEmbellishments();
			});

			$('body').on('click', 'button#searchTextButton', function (e) {
				getEmbellishments();
			});	

			// GET ALL SAMPLE CLIPART FROM SERVER BY AJAX CALL
			function getEmbellishments() {
				var searchText = $('#searchText').val();
				var url = BASE_URL+'design/FrameDesign/';
				if ($.trim(searchText) != '') {
					searchText = searchText.replace(/ /g, "+");
				}
				$.ajax({
					type: 'GET',
					url: url,
					dataType:'json',
					data: { "searchText": searchText ,"type":'embellish'},
					beforeSend: function () {
						$('#embellishListBody').html('<div class="text-center"><i class="fa fa-refresh fa-spin" style="font-size:24px"></i> Loading...</div>');
					},
					success: function (response) {
						var fileList = response;
						var html = '';
						if (fileList.length > 0) {
							html+='<ul class="emilishlist">';
							for (var i = 0; i < fileList.length; i++) {
								var newImg= (fileList[i].path).replace("gallery/image/", "gallery/image/small/"); 
								var img_url = BASE_URL+"pub/media/"+newImg;
								var data_img_url = BASE_URL+"pub/media/"+fileList[i].path;
								var img_name = fileList[i].name;
								var img_id = fileList[i].image_id;
								var cls='';
								if(img_id == 31)
									cls="class='active'";
								else
									cls='';
								html += '<li '+cls+'>' +
									'<img src="' + img_url + '" data-src="'+data_img_url+'" alt="" />' +
									'<h2>' + img_name + '</h2>' +
									'</li>';
							}
							html+='</ul>';
						} else {
							html = '<div class="text-center">No embellishments found.</div>';
						}
						$('#embellishListBody').html(html);
					},
					error: function () {}
				});
			}

			function getMatt() {
				var url = BASE_URL+'design/FrameDesign/';
				$.ajax({
					type: 'GET',
					url: url,
					dataType:'json',
					data: { "type":'matt'},
					beforeSend: function () {
						$('#MattListBody').html('<div class="text-center"><i class="fa fa-refresh fa-spin" style="font-size:24px"></i> Loading...</div>');
					},
					success: function (response) {
						var fileList = response;
						mattList = fileList
						var html = '';
						if (fileList.length > 0) {
							html+='<ul class="topmattlist">';
							for (var i = 0; i < fileList.length; i++) {								
								var img_url = FRAME_URL+"matt/small/"+fileList[i].Image;
								var data_img_url = FRAME_URL+"matt/"+fileList[i].Image;
								var img_name = fileList[i].Name;
								var cls='';
								if(fileList[i].Image == DEFAULT_VALUES.defaultMatt)
								 cls = 'class="active"';
								else
								 cls = '';
								html += '<li '+cls+'>' +
									'<img  class="mattimg" src="' + img_url + '" data-src="'+data_img_url+'" alt="" width="84" height="47" />' +
									'<h2>' + img_name + '</h2>' +
									'</li>';
							}
							html+='</ul>';
						} else {
							html = '<div class="text-center">No Matt found.</div>';
						}
						$('#MattListBody').html(html);
						getSecondMatt();
					},
					error: function () {}
				});
			}

			function getSecondMatt() {
				var fileList = mattList;
				var html = '';
				if (fileList.length > 0) {
					html+='<ul class="bottommattlist">';
					for (var i = 0; i < fileList.length; i++) {						
						var img_url = FRAME_URL+"matt/small/"+fileList[i].Image;
						var data_img_url = FRAME_URL+"matt/"+fileList[i].Image;
						var img_name = fileList[i].Name;
						var cls='';
						if(fileList[i].Image == DEFAULT_VALUES.defaultSecondMatt)
							cls = 'class="active"';
						else
							cls = '';
						html += '<li '+cls+'>' +
							'<img  class="mattimg" src="' + img_url + '" data-src="'+data_img_url+'" alt="" width="84" height="47" />' +
							'<h2>' + img_name + '</h2>' +
							'</li>';
					}
					html+='</ul>';
				} else {
					html = '<div class="text-center">No Matt found.</div>';
				}
				$('#MattSecondListBody').html(html);
			}				

			$('#saveCanvas').click( function(e){
				var topmatt = bottommatt = image= embillish = plate = background = text = fontsize = '';
				var c = $canvas.getLayers();
				$.each( c, function( key, value ) {
					  var res = c[key].source;
					  if(c[key].name == "topmatt"){				  	
						topmatt=res;
					  }
					  else if(c[key].name == "TopboxLayer"){
						bottommatt=res;
					  }
					  else if(c[key].name == "uploadImageLayer"){
						image=res;
					  }
					  else if(c[key].name == "embillishLayer"){
						embillish=res;
					  }
					  else if(c[key].name == "plateLayer"){
						plate=res;
					  }
					  else if(c[key].name == "textLayer"){
						text=c[key].text;
						fontsize=c[key].fontSize;
						fontfamily=c[key].fontFamily;
					  }
					  else if(c[key].name == "backgroundframe"){
						background=res;
					  }
				});
				$("#dialog-save").dialog({
	                buttons: {
	                    "Yes": function () {
	                        $(this).dialog("close");
							$('#main_wrapper').addClass('hidden');
							$('#load_wrapper').removeClass('hidden');
							var width = $('#framewidth').val();
							var frameId = $('#frameId').val();	
							var data = { 
								canvasimg: $('#mainCanvas').getCanvasImage('png'),
								width:width,
								frameId:frameId,
								price:DEFAULT_VALUES.defaultPrice,
								topmatt:topmatt,
								bottommatt:bottommatt,
								image:image,
								embillish:embillish,
								plate:plate,
								background:background,
								text:text,
								fontsize:fontsize,
								dimension:dimension
							};
							console.log("====",data);
							var url = BASE_URL+'design/FrameDesign/';
							$.ajax({
								type: 'POST',
								url: url,
								dataType:'json',
								data: { "type":'save',data: data },
								beforeSend: function () {},
								success: function (response) {
									var data = response.data;
									window.location.href = BASE_URL+'checkout/cart/';
								},
								error: function(response) {
									response = response.responseText;
									response = JSON.parse(response);
									console.log( response.message);
								}
							});
						
	                    },
	                    "No": function () {
	                        $(this).dialog("close");
	                    }
	                },
	                open: function(event, ui) {
	                    // Get the dialog
	                    var dialog = $(event.target).parents(".ui-dialog.ui-widget");

	                    // Get the buttons
	                    var buttons = dialog.find(".ui-dialog-buttonpane").find("button");

	                    var yesButton = buttons[0];
	                    var noButton = buttons[1];
	                    // Add class to the buttons
	                    $(noButton).addClass("btn-danger");
	                    $(yesButton).addClass("btn-success");
	                }
	            });
	            $("#dialog-save").dialog("open");
				//console.log(CanvasElement);
				// bootbox.confirm({
				// 	message: "Are you done with the Frame Designing? Click <b>Yes</b> to save and proceed to cart or click <b>No</b> to continue editing.",

				// 	buttons: {
				// 		confirm: {
				// 			label: 'Yes',
				// 			className: 'btn-success'
				// 		},
				// 		cancel: {
				// 			label: 'No',
				// 			className: 'btn-danger'
				// 		}
				// 	},
				// 	callback: function (chooseresult) {
				// 		if( chooseresult){
				// 			$('#main_wrapper').addClass('hidden');
				// 			$('#load_wrapper').removeClass('hidden');
				// 			var width = $('#framewidth').val();
				// 			var frameId = $('#frameId').val();	
				// 			var data = { 
				// 				canvasimg: $('#mainCanvas').getCanvasImage('png'),
				// 				width:width,
				// 				frameId:frameId,
				// 				price:DEFAULT_VALUES.defaultPrice,
				// 				topmatt:topmatt,
				// 				bottommatt:bottommatt,
				// 				image:image,
				// 				embillish:embillish,
				// 				plate:plate,
				// 				background:background,
				// 				text:text,
				// 				fontsize:fontsize,
				// 				dimension:dimension
				// 			};
				// 			console.log("====",data);
				// 			var url = BASE_URL+'design/FrameDesign/';
				// 			$.ajax({
				// 				type: 'POST',
				// 				url: url,
				// 				dataType:'json',
				// 				data: { "type":'save',data: data },
				// 				beforeSend: function () {},
				// 				success: function (response) {
				// 					var data = response.data;
				// 					window.location.href = BASE_URL+'checkout/cart/';
				// 				},
				// 				error: function(response) {
				// 					response = response.responseText;
				// 					response = JSON.parse(response);
				// 					console.log( response.message);
				// 				}
				// 			});
				// 		}
				// 	}
				// });
			});

			$('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {				
				if($(e.target).data('id') == 1 || $(e.target).data('id') ==9){
					$('#prevcanv').hide();
				}
				else{
					$('#prevcanv').show();
					$('.custom-pop').addClass('hidden');
					$('#prevcanv').removeClass();
					$('#prevcanv').addClass('col-sm-4 col-md-4 col-lg-4 step'+$(e.target).data('id'));
				}
			});

			$(document).on("contextmenu",function(e){ 
				console.log(e.target); 
             	//e.preventDefault();
			 });	
			
			$('#resetCanvas').click(function (e) {

				$("#dialog-reset").dialog({
	                buttons: {
	                    "Reset": function () {
	                        deleteElement('backgroundGrp', true);				
	                        $(this).dialog("close");
							notifyMessage('The frame has been reset successfully!', 'success');

							setTimeout(function() {

								window.location.href = BASE_URL+'frameeditor/';

							}, 2000);
	                    },
	                    "Cancel": function () {
	                        $(this).dialog("close");
	                    }
	                },
	                open: function(event, ui) {
	                    // Get the dialog
	                    var dialog = $(event.target).parents(".ui-dialog.ui-widget");

	                    // Get the buttons
	                    var buttons = dialog.find(".ui-dialog-buttonpane").find("button");

	                    var resetButton = buttons[0];
	                    var cancelButton = buttons[1];
	                    // Add class to the buttons
	                    $(resetButton).addClass("btn-danger");
	                    $(cancelButton).addClass("btn-success");
	                }
	            });
            	$("#dialog-reset").dialog("open");
				// bootbox.confirm({

				// 	message: "Are you sure you want to reset the frame design?",

				// 	buttons: {

				// 		confirm: {

				// 			label: 'Reset',

				// 			className: 'btn-success'

				// 		},

				// 		cancel: {

				// 			label: 'Cancel',

				// 			className: 'btn-danger'

				// 		}

				// 	},

				// 	callback: function (chooseresult) {

				// 		if( chooseresult){						

				// 			deleteElement('backgroundGrp', true);				

				// 			notifyMessage('The frame has been reset successfully!', 'success');

				// 			setTimeout(function() {

				// 				window.location.href = BASE_URL+'frameeditor/';

				// 			}, 2000);

				// 		}

				// 	}

				// });


			});

			$('.navigation ul li a').click(function(e){

				var href = $(this).attr('href');

				e.preventDefault(); 
				$("#dialog-leavePage").dialog({
	                buttons: {
	                    "Leave Page": function () {
	                        window.location.href = href;
	                    },
	                    "Stay on page": function () {
	                        $(this).dialog("close");
	                        return true;
	                    }
	                },
	                open: function(event, ui) {
	                    // Get the dialog
	                    var dialog = $(event.target).parents(".ui-dialog.ui-widget");

	                    // Get the buttons
	                    var buttons = dialog.find(".ui-dialog-buttonpane").find("button");

	                    var leaveButton = buttons[0];
	                    var stayButton = buttons[1];
	                    // Add class to the buttons
	                    $(leaveButton).addClass("btn-danger");
	                    $(stayButton).addClass("btn-success");
	                }
	            });
	            $("#dialog-leavePage").dialog("open");
				// bootbox.confirm({

				// 	message: "Are you sure you want to leave this page? If you leave this page now, your current frame design will be discarded. Click <b>Stay on page</b> to continue editing, or <b>Leave Page</b> to discard the changes.",

				// 	buttons: {

				// 		confirm: {

				// 			label: 'Leave Page',

				// 			className: 'btn-success'

				// 		},

				// 		cancel: {

				// 			label: 'Stay on page',

				// 			className: 'btn-danger'

				// 		}

				// 	},

				// 	callback: function (chooseresult) {

				// 		if( chooseresult){

				// 			window.location.href = href;

				// 		}

				// 		else

				// 			return true;

				// 	}

				// });

			});

			$('.logo').click(function(e){ 
				var href = $(this).attr('href');
				e.preventDefault();
				$("#dialog-leavePage").dialog({
	                buttons: {
	                    "Leave Page": function () {
	                        window.location.href = href;
	                    },
	                    "Stay on page": function () {
	                        $(this).dialog("close");
	                        return true;
	                    }
	                },
	                open: function(event, ui) {
	                    // Get the dialog
	                    var dialog = $(event.target).parents(".ui-dialog.ui-widget");

	                    // Get the buttons
	                    var buttons = dialog.find(".ui-dialog-buttonpane").find("button");

	                    var leaveButton = buttons[0];
	                    var stayButton = buttons[1];
	                    // Add class to the buttons
	                    $(leaveButton).addClass("btn-danger");
	                    $(stayButton).addClass("btn-success");
	                } 
	            });
	            $("#dialog-leavePage").dialog("open");
				// bootbox.confirm({
				// 	message: "Are You sure leave this page? Click <b>Leave Page</b>. If you leave this page your current Frame design no longer exists",
				// 	buttons: {
				// 		confirm: {
				// 			label: 'Leave Page',
				// 			className: 'btn-success'
				// 		},
				// 		cancel: {
				// 			label: 'Stay on page',
				// 			className: 'btn-danger'
				// 		}
				// 	},
				// 	callback: function (chooseresult) {
				// 		if( chooseresult){
				// 			window.location.href = href;
				// 		}
				// 		else
				// 			return true;
				// 	}
				// });
			});
		});
	});

}, 4000);