require(['jquery', 'jquery/ui'], function ($) {
	$(document).ready(function () {
		function addClassFooter(){
			var windowHeight = $(window).height();
			var bodyHeight = $("body").height();
			if(windowHeight > bodyHeight){
				$(".copyright").addClass("footerFixed");
			}
			else{
				$(".copyright").removeClass("footerFixed");
			}
		}
		if($(window).width() < 767){ 
			
			addClassFooter();
			$(".block-collapsible-nav-title").click(function(){
				$(".content.block-collapsible-nav-content").slideToggle();
			})
			$("body").click(function(){
				setTimeout(function(){
					var canvasHeight = $("#prevcanv").outerHeight();
					$("#step2 .inside-content, #step3 .inside-content, #step4 .inside-content, #step5 .inside-content, #step6 .inside-content, #step7 .inside-content, #step8 .inside-content, #step9 .inside-content").css('min-height', (canvasHeight + 325));
					//$("#upload-img #prevcanv").css({'top':(canvasHeight-20)});
					if($("#upload-img #prevcanv").hasClass("alterCanvas")){
						var getMenuHeight = $("#upload-img").find("ul.nav").height();
						$("#upload-img #prevcanv.alterCanvas").animate({'top':'760px'});
					}
					else{
						$("#upload-img #prevcanv").animate({'top':'400px'});
					}
				},10);
			});
		}
		
		function footerStaticFixed(){
			if($(".canvas-loader").hasClass("hidden")){
				$(".copyright").addClass("fixedFooter");
			}
			else{
				$(".copyright").removeClass("fixedFooter");
			}
			$("#upload-img").load(function(){
				alert('hi');
			});
		}
		
		function addGridIcon(){
			if($(window).width() < 767){
				$(".navigation").find("ul.ui-menu").css('display','none');
				$(".navigation").append("<div class='toggle-icon'><span></span><span></span><span></span></div>");
				$(".toggle-icon").on('click', function(){
					$(".navigation").find("ul").slideToggle();
				});
				$(".navigation").find("ul.ui-menu a, ul.ui-menu a span").on('click', function(){
					$(".navigation").find("ul.ui-menu").slideUp();
				});
				
				$("#upload-img ul.nav.nav-pills").slideUp();
				$("<div class='tab-menu'>Click and View the Toools Menu</div>").insertBefore("#upload-img ul.nav.nav-pills");
				$(".tab-menu").append("<div class='tab-toggle'><span></span><span></span><span></span></div>");
				$(".tab-menu").on('click', function(){
					$("#upload-img ul.nav.nav-pills").slideToggle();
					$("#prevcanv").toggleClass("alterCanvas");
				});
				$("#upload-img ul.nav.nav-pills a").click(function(){
					$("#upload-img ul.nav.nav-pills").slideUp();
					$("#prevcanv").removeClass("alterCanvas");
				});
				$(".selected-radio-btn").click(function(){
					//$(this).find("input[type='radio']").prop('checked',true);
					//$(this).find("input").trigger("click");
					$(".selected-radio-btn").removeClass("active");
					$(this).addClass("active");
				});
				//footerStaticFixed();
			}
		}
		function clickToTop(){
			$(".down-arrow").click(function(){
				$("body, html").animate({scrollTop:0}, "slow");
			});
		}
		
		function frameslist(){
			var minHeight = 0;
			$("#upload-img ul.frameslist li").each(function(){
				var maxHeight = $(this).height();
				if(maxHeight > minHeight){
					minHeight = maxHeight;
				}
			});
			$("#upload-img ul.frameslist li").css('height', minHeight);
		}
		function topmattlist(){
			var minHeight = 0;
			$("#upload-img ul.topmattlist li").each(function(){
				var maxHeight = $(this).height();
				if(maxHeight > minHeight){
					minHeight = maxHeight;
				}
			});
			$("#upload-img ul.topmattlist li").css('height', minHeight);
		}
		function toolsEqualHeight(){
			$("#upload-img ul.nav.nav-pills li a").click(function(){
				setTimeout(function(){
					topmattlist();
					frameslist();
				},1000);
			});
		}
		/*function leftPanelHeight(){
			if($(window).width() < 767){
				var mainBoxHeight = $("#maincontent").outerHeight();
				$("body.account .inside-middel-section .sidebar.sidebar-main").css('height', mainBoxHeight);
			}
		}
		leftPanelHeight();
		$(window).resize(function () {
			leftPanelHeight();
		});*/
		function topPosition(){
			var boxHeight = $(".flatpanel").outerHeight()/2;
			var boxWidth = $(".flatpanel").outerWidth();
			$(".flatpanel").css('margin-top', -boxHeight);
			$("body").click(function(){
				var boxHeight = $(".flatpanel").outerHeight()/2;
				$(".flatpanel").css('margin-top', -boxHeight);
			});
			$(".flatpanel").css({'right' : -boxWidth});
			$(".arw-open").click(function(){
				$(".flatpanel").animate({'right' : 0},500, function(){
					$(".arw-open").animate({'left':'-40px'},300);
				});
			});
			$("#close").click(function(){
				$(".flatpanel").animate({'right' : -boxWidth},500, function(){
					$(".arw-open").animate({'left':'-74px'},300);
				});
			});
		}
		function openBox(){
			$(".flatpanel").append("<span class='arw-open'>Your Selections</span>")
		}
		function selectAlterFrame(){
			$(".img-place-box").find(".frame-selection").hide();
			$("ul.dropdown-menu").find("li").click(function(){
				$(".img-place-box").find(".frame-selection").hide();
				var getIndex = $(this).index();
				$(".img-place-box").find(".frame-selection").eq(getIndex).show();
			});
		}
		function selectTextFrame(){
			$(".img-place-box").find(".frame-selection span.selected-txt").remove();
			$("ul.dropdown-menu").find("li a").attr('href', 'javascript:void(0)');
			$("ul.dropdown-menu").find("li").click(function(){
				var getIndex = $(this).index();
				$(".img-place-box").find(".frame-selection span.selected-txt").remove();
				$(".img-place-box").find(".frame-selection").eq(getIndex).append("<span class='selected-txt'><i class='fa fa-check-square-o'></i>Selected</span>");
			});
		}
		function getInnerWidth(){
			$("body").click(function(){
				var getPreviewWidth = $("#upload-img").find(".previewcanvas").outerWidth();
				$("#upload-img").find(".previewcanvas").prev(".preview-txt").css('width', getPreviewWidth);
			});
		}
		function clickAlert(){
			$("#btn-next-tab").click(function(){
				var btnValueText = $(this).closest("#upload-img").find(".dropdown-toggle").val();
				if(btnValueText == " "){
					alert('No');
				}
				else{
					alert("Yes");
				}
			});
		}
		function radioSelect(){
			//$(".selected-radio-btn").text('Select');
			$(".selected-radio-btn").find("input[type='radio']").click(function(){
				if($(this).prop("checked") == true){
					$(".selected-radio-btn").removeClass("active");
					$(this).closest(".selected-radio-btn").addClass("active");
				}
			});
			/*$("ul.frameslist li").click(function(){
				$("ul.frameslist li").removeClass("activelist");
				$(this).addClass("activelist");
			});*/
		}
		function previusCanvasHeight(){
			$("body").click(function(){
				setTimeout(function(){
					//var getImgHeight = $(".previewcanvas").find("img").height();
					//$(".previewcanvas").css('min-height', getImgHeight);
					//console.log(getImgHeight);
				},200);
			});
		}
		function tabContentHeight(){
			$("body").click(function(){
				var getCanvasHeight = $("#prevcanv").outerHeight();
				$("#upload-img .tab-content").css('min-height', (getCanvasHeight+40));
				$(".inside-content").css('min-height', (getCanvasHeight-10));
			});
			/*$("a[href='#step9']").click(function(){
				var getInsideImgHeight = $(".previewcanvas").find("img").outerHeight();
				$("#upload-img .tab-content").css('min-height', (getInsideImgHeight+40));
			});*/
		}
		$(window).load(function () {
			addGridIcon();
			clickToTop();
			//toolsEqualHeight();
			topPosition();
			openBox();
			//selectAlterFrame();
			selectTextFrame();
			//getInnerWidth();
			//clickAlert();
			radioSelect();
			previusCanvasHeight();
			tabContentHeight();
		});
		$(window).load(function () {
			topPosition();
		});
	});
});